/**
 * Rebalancer, manages a single concentrated PancakeSwap V3 WBNB/USDT (0.01%
 * fee tier) liquidity position on BSC Testnet, and resets its range whenever
 * price drifts outside it.
 *
 * Same discipline as the other two reference agents (healthFactorGuard.ts,
 * yieldRouterCore.ts): this is fixed code, never an LLM tool. All signing
 * lives in `signing.ts`; this module only decides *whether* to act and
 * builds the real on-chain calls.
 *
 * Position lifecycle, entirely derived from live chain state each run (no
 * local state file, the NFT the wallet owns *is* the state):
 *   - No position owned  -> wrap idle native BNB into WBNB, then run the
 *     shared `sizeSwapAndMint` sequence to open one.
 *   - Position owned, in range, wallet also holds idle USDT/WBNB dust above
 *     a worthwhile threshold (e.g. left over from a less-precise earlier
 *     mint) -> rebalance the dust to the position's own ratio and fold it
 *     in via increaseLiquidity, instead of leaving capital sitting idle.
 *   - Position owned, in range, no meaningful dust -> no action.
 *   - Position owned, current tick has drifted outside the range -> remove
 *     it (decreaseLiquidity + collect + burn, batched into one multicall,
 *     the same atomic pattern PancakeSwap/Uniswap's own front end uses),
 *     then run `sizeSwapAndMint` again to re-open centered on the new tick.
 *
 * Sizing (`sizeSwapAndMint`): a single swap sized from the pre-swap price
 * isn't enough on a thin pool, the swap itself moves the price (verified
 * the hard way: an initial 50/50-split open left ~99.98% of the USDT side
 * as unused dust, because the range had been fixed against the pre-swap
 * tick and the swap moved price past it before the mint landed). The real
 * fix is two-phase: size and execute an initial swap against the
 * *pre-swap* price, then re-read the pool for real, finalize the mint range
 * against *that* price, and, if the swap's own impact left the resulting
 * balances more than a couple of percent off the now-final range's actual
 * required ratio, run one bounded corrective swap before minting. Every
 * mint/swap here still carries real `amountMin`/`amountOutMinimum` floors;
 * this sizing logic only affects capital efficiency (how much ends up
 * working vs. idle), never correctness.
 *
 * v2 (2026-10-01): acting is no longer automatic. v1 re-centred every time
 * price left the range and swapped every scrap of idle dust back in. On a
 * pool whose fee income is close to zero that is pure cost: each re-centre
 * buys back into whichever side just fell, and pays gas for it. Measured
 * against leaving its first range alone, v1 ended up ~21% behind. v2 first
 * reads what this pool actually paid liquidity over the last 7 days (from
 * the pool's own feeGrowthGlobal counters, scaled to this position's
 * liquidity) and only rebalances or folds dust when that expected income is
 * at least ACT_MULTIPLE times the gas the move would cost. Otherwise it
 * holds. It also skips approvals the existing allowance already covers.
 *
 * Scope: one position at a time, always the WBNB/USDT 0.01% pool (the
 * only fee tier with real testnet liquidity across all four checked). A
 * ±500-tick band (~5%) is deliberately narrow enough that testnet's thin,
 * occasionally-jumpy pricing can realistically push it out of range during
 * a demo, instead of picking a full-range band that would never need
 * rebalancing at all.
 */

import { getWallet } from "@bnbagent/studio-runtime/wallet";
import type { WalletProvider } from "@bnbagent/sdk";
import { encodeFunctionData, formatEther, parseEther, type Address, type PublicClient } from "viem";
import {
  computeOptimalSwap,
  erc20Abi,
  getPancakePublicClient,
  getPoolState,
  getArchivePublicClient,
  nfpmAbi,
  PANCAKE_TESTNET,
  poolAbi,
  quoteExactInputSingle,
  swapRouterAbi,
  wbnbAbi,
  type OptimalSwap,
  type PoolState,
} from "./pancake.js";

const RESERVE_BNB = parseEther("0.02"); // always keep this much for gas
const MIN_OPEN_BNB = parseEther("0.02"); // don't bother opening a dust position
const RANGE_HALF_WIDTH_TICKS = 500; // ~5% band around current price (tickSpacing=1 on this pool)
const SLIPPAGE_BPS = 500n; // 5%, real protection, not faked away just because it's testnet
const MAX_UINT128 = (1n << 128n) - 1n; // sentinel for "collect everything owed"
const DUST_USDT_FLOOR = 10_000n; // ~1 cent (6dp), below this, not worth a swap+mint's gas
const DUST_WBNB_FLOOR = parseEther("0.001");

// v2 fee gate. Gas units are estimates from this agent's own past receipts:
// a full remove + swaps + approvals + mint came to ~1.2M gas, a dust fold
// (swap, approvals, increaseLiquidity) to ~0.6M.
const FEE_LOOKBACK_BLOCKS = 1_400_000n; // ~7 days of BSC Testnet blocks; the real span is measured from timestamps
const FEE_HORIZON_DAYS = 7;
const ACT_MULTIPLE = 2;
const REBALANCE_GAS_UNITS = 1_200_000n;
const DUST_FOLD_GAS_UNITS = 600_000n;

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes out
}

type Executor = ReturnType<WalletProvider["makeExecutor"]>;

async function tokenBalances(client: PublicClient, owner: Address): Promise<{ usdt: bigint; wbnb: bigint }> {
  const [usdt, wbnb] = await Promise.all([
    client.readContract({ address: PANCAKE_TESTNET.USDT, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
    client.readContract({ address: PANCAKE_TESTNET.WBNB, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
  ]);
  return { usdt, wbnb };
}

/** Wrap native BNB into a plain ERC20 WBNB balance, a no-op on pool price (not a swap). */
async function wrapNative(executor: Executor, amount: bigint): Promise<string[]> {
  if (amount === 0n) return [];
  const res = await executor.execute({
    call: { address: PANCAKE_TESTNET.WBNB, abi: wbnbAbi, functionName: "deposit", args: [] },
    value: amount,
    description: `Wrap ${formatEther(amount)} native BNB into WBNB`,
  });
  return [res.transactionHash];
}

/**
 * Execute one swap leg of a `computeOptimalSwap` recommendation via
 * SmartRouter, always through a normal ERC20 approve + transferFrom (both
 * legs are plain tokens here, native BNB is wrapped up front by the
 * caller). Deadline protection comes from SmartRouter's own
 * `multicall(uint256 deadline, bytes[] data)` overload (see pancake.ts's
 * header note on why the plain `exactInputSingle` struct has no deadline
 * field of its own on this specific router).
 */
async function executeSwap(wallet: WalletProvider, executor: Executor, tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<string[]> {
  const quotedOut = await quoteExactInputSingle(tokenIn, tokenOut, amountIn);
  const amountOutMinimum = (quotedOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;

  const approveTxHashes = await approveIfNeeded(
    executor,
    wallet.address as Address,
    tokenIn,
    PANCAKE_TESTNET.swapRouter,
    amountIn,
    `Approve SmartRouter to pull ${amountIn} raw units of ${tokenIn} for a rebalancing swap`,
  );

  const swapCalldata = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [{ tokenIn, tokenOut, fee: PANCAKE_TESTNET.FEE_1BP, recipient: wallet.address, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
  });
  const swapRes = await executor.execute({
    call: { address: PANCAKE_TESTNET.swapRouter, abi: swapRouterAbi, functionName: "multicall", args: [deadline(), [swapCalldata]] },
    description: `Swap ${amountIn} raw units ${tokenIn} -> ${tokenOut} (quoted ${quotedOut}, min ${amountOutMinimum})`,
  });

  return [...approveTxHashes, swapRes.transactionHash];
}

/** Approves only when the current allowance doesn't already cover `amount`. */
async function approveIfNeeded(executor: Executor, owner: Address, token: Address, spender: Address, amount: bigint, description: string): Promise<string[]> {
  const current = await getPancakePublicClient().readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  if (current >= amount) return [];
  const res = await executor.execute({ call: { address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }, description });
  return [res.transactionHash];
}

/** Apply a `computeOptimalSwap` recommendation, if any, and return its tx hashes. */
async function applyOptimalSwap(wallet: WalletProvider, executor: Executor, swap: OptimalSwap): Promise<string[]> {
  if (swap.direction === "none" || swap.amountIn === 0n) return [];
  const [tokenIn, tokenOut] =
    swap.direction === "token0_to_token1" ? [PANCAKE_TESTNET.USDT, PANCAKE_TESTNET.WBNB] : [PANCAKE_TESTNET.WBNB, PANCAKE_TESTNET.USDT];
  return executeSwap(wallet, executor, tokenIn, tokenOut, swap.amountIn);
}

async function approveNfpmForMint(executor: Executor, owner: Address, usdtAmount: bigint, wbnbAmount: bigint): Promise<string[]> {
  const txHashes: string[] = [];
  if (usdtAmount > 0n) {
    txHashes.push(
      ...(await approveIfNeeded(executor, owner, PANCAKE_TESTNET.USDT, PANCAKE_TESTNET.nfpm, usdtAmount, `Approve NonfungiblePositionManager to pull ${usdtAmount} raw USDT`)),
    );
  }
  if (wbnbAmount > 0n) {
    txHashes.push(
      ...(await approveIfNeeded(executor, owner, PANCAKE_TESTNET.WBNB, PANCAKE_TESTNET.nfpm, wbnbAmount, `Approve NonfungiblePositionManager to pull ${wbnbAmount} raw WBNB`)),
    );
  }
  return txHashes;
}

/** WBNB per USDT at a tick (token0 USDT 6 dp, token1 WBNB 18 dp). */
function wbnbPerUsdt(tick: number): number {
  return (1.0001 ** tick * 1e6) / 1e18;
}

/** What a position would pay out if closed at `tick`, in BNB. */
function positionValueBnb(liquidity: bigint, tickLower: number, tickUpper: number, tick: number): number {
  const L = Number(liquidity);
  const sqrt = (t: number) => Math.sqrt(1.0001 ** t);
  const [sa, sb] = [sqrt(tickLower), sqrt(tickUpper)];
  const sp = Math.min(Math.max(sqrt(tick), sa), sb);
  const usdt = (L * (1 / sp - 1 / sb)) / 1e6;
  const wbnb = (L * (sp - sa)) / 1e18;
  return wbnb + usdt * wbnbPerUsdt(tick);
}

/**
 * What this pool paid `liquidity` in trading fees over roughly the last 7
 * days, scaled to FEE_HORIZON_DAYS and valued in BNB. Read from the pool's
 * own feeGrowthGlobal counters at both ends of the window, so it assumes
 * the liquidity sat in range the whole time: an upper bound, which only
 * makes the gate more willing to act, never less.
 */
export async function recentFeeIncomeBnb(pool: PoolState, liquidity: bigint): Promise<{ feesBnb: number; days: number }> {
  const archive = getArchivePublicClient();
  const head = await archive.getBlockNumber();
  const from = head - FEE_LOOKBACK_BLOCKS;
  const read = (blockNumber: bigint) =>
    Promise.all([
      archive.readContract({ address: pool.pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128", blockNumber }),
      archive.readContract({ address: pool.pool, abi: poolAbi, functionName: "feeGrowthGlobal1X128", blockNumber }),
      archive.getBlock({ blockNumber }).then((b) => b.timestamp),
    ]);
  const [[g0From, g1From, tFrom], [g0Now, g1Now, tNow]] = await Promise.all([read(from), read(head)]);
  const days = Number(tNow - tFrom) / 86_400;
  const usdt = Number(((g0Now - g0From) * liquidity) >> 128n) / 1e6;
  const wbnb = Number(((g1Now - g1From) * liquidity) >> 128n) / 1e18;
  const feesBnb = ((wbnb + usdt * wbnbPerUsdt(pool.tick)) * FEE_HORIZON_DAYS) / Math.max(days, 1e-9);
  return { feesBnb, days };
}

/** Gas a move would cost at today's gas price, in BNB. */
export async function gasCostBnb(gasUnits: bigint): Promise<number> {
  const gasPrice = await getPancakePublicClient().getGasPrice();
  return Number(formatEther(gasPrice * gasUnits));
}

function isDust(usdt: bigint, wbnb: bigint): boolean {
  return usdt < DUST_USDT_FLOOR && wbnb < DUST_WBNB_FLOOR;
}

export interface MintOutcome {
  tickLower: number;
  tickUpper: number;
  poolTick: number;
  tokenId: bigint | null;
  txHashes: string[];
}

/**
 * Shared open/re-open sequence: starting from whatever USDT/WBNB the wallet
 * already holds (ERC20 balances only, wrap native first if needed), size
 * and run a swap against the current price, re-read the pool for the
 * *actual* post-swap price, finalize the mint range against that, and run
 * one bounded corrective swap if the swap's own price impact left the
 * balances meaningfully off-ratio for that final range. Always mints with
 * `amountMin: 0`, this function's job is capital efficiency, never a
 * safety boundary.
 */
async function sizeSwapAndMint(wallet: WalletProvider, executor: Executor, client: PublicClient): Promise<MintOutcome> {
  const provisionalPool = await getPoolState();
  const provisionalTickLower = provisionalPool.tick - RANGE_HALF_WIDTH_TICKS;
  const provisionalTickUpper = provisionalPool.tick + RANGE_HALF_WIDTH_TICKS;

  const initialBal = await tokenBalances(client, wallet.address as Address);
  const initialSwap = computeOptimalSwap(initialBal.usdt, initialBal.wbnb, provisionalPool.sqrtPriceX96, provisionalTickLower, provisionalTickUpper);
  const txHashes = await applyOptimalSwap(wallet, executor, initialSwap);

  // Re-read for real: the swap we just ran moves price on a thin pool, so
  // the range we actually mint into, and any corrective swap, must be
  // sized against the price as it stands now, not as it stood before we
  // traded.
  const finalPool: PoolState = await getPoolState();
  const finalTickLower = finalPool.tick - RANGE_HALF_WIDTH_TICKS;
  const finalTickUpper = finalPool.tick + RANGE_HALF_WIDTH_TICKS;

  let bal = await tokenBalances(client, wallet.address as Address);
  const correctiveSwap = computeOptimalSwap(bal.usdt, bal.wbnb, finalPool.sqrtPriceX96, finalTickLower, finalTickUpper);
  if (correctiveSwap.direction !== "none") {
    txHashes.push(...(await applyOptimalSwap(wallet, executor, correctiveSwap)));
    bal = await tokenBalances(client, wallet.address as Address);
  }

  txHashes.push(...(await approveNfpmForMint(executor, wallet.address as Address, bal.usdt, bal.wbnb)));

  const mintRes = await executor.execute({
    call: {
      address: PANCAKE_TESTNET.nfpm,
      abi: nfpmAbi,
      functionName: "mint",
      args: [
        {
          token0: PANCAKE_TESTNET.USDT,
          token1: PANCAKE_TESTNET.WBNB,
          fee: PANCAKE_TESTNET.FEE_1BP,
          tickLower: finalTickLower,
          tickUpper: finalTickUpper,
          amount0Desired: bal.usdt,
          amount1Desired: bal.wbnb,
          amount0Min: 0n,
          amount1Min: 0n,
          recipient: wallet.address,
          deadline: deadline(),
        },
      ],
    },
    description: `Mint LP position: ${bal.usdt} raw USDT + ${bal.wbnb} raw WBNB, range [${finalTickLower}, ${finalTickUpper}) around tick ${finalPool.tick}`,
  });
  txHashes.push(mintRes.transactionHash);

  const opened = await findOwnedPosition(wallet.address as Address);
  return { tickLower: finalTickLower, tickUpper: finalTickUpper, poolTick: finalPool.tick, tokenId: opened?.tokenId ?? null, txHashes };
}

export interface OwnedPosition {
  tokenId: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}

async function findOwnedPosition(owner: Address): Promise<OwnedPosition | null> {
  const c = getPancakePublicClient();
  const count = await c.readContract({ address: PANCAKE_TESTNET.nfpm, abi: nfpmAbi, functionName: "balanceOf", args: [owner] });
  if (count === 0n) return null;

  // v1 only ever holds one position at a time, take index 0.
  const tokenId = await c.readContract({ address: PANCAKE_TESTNET.nfpm, abi: nfpmAbi, functionName: "tokenOfOwnerByIndex", args: [owner, 0n] });
  const pos = await c.readContract({ address: PANCAKE_TESTNET.nfpm, abi: nfpmAbi, functionName: "positions", args: [tokenId] });
  return { tokenId, tickLower: pos[5], tickUpper: pos[6], liquidity: pos[7] };
}

export interface RebalanceResult {
  timestamp: string;
  poolTick: number;
  position: { tokenId: string; tickLower: number; tickUpper: number; inRange: boolean } | null;
  actionTaken: boolean;
  action?: {
    type: "open_position" | "rebalance_position" | "deploy_idle_dust";
    tokenId: string;
    txHashes: string[];
  };
  skippedReason?: string;
}

export async function checkAndRebalance(): Promise<RebalanceResult> {
  const wallet = getWallet();
  const client = getPancakePublicClient();
  const timestamp = new Date().toISOString();
  const pool = await getPoolState();
  const executor = wallet.makeExecutor({ client });

  const owned = await findOwnedPosition(wallet.address as Address);

  // --- No position yet: wrap idle native BNB, then open one ---
  if (!owned) {
    const nativeBalance = await client.getBalance({ address: wallet.address });
    const available = nativeBalance > RESERVE_BNB ? nativeBalance - RESERVE_BNB : 0n;
    if (available < MIN_OPEN_BNB) {
      return {
        timestamp,
        poolTick: pool.tick,
        position: null,
        actionTaken: false,
        skippedReason: `no position and only ${formatEther(available)} BNB idle above the ${formatEther(RESERVE_BNB)} gas reserve, below the ${formatEther(MIN_OPEN_BNB)} minimum to open one`,
      };
    }

    const wrapTxHashes = await wrapNative(executor, available);
    const outcome = await sizeSwapAndMint(wallet, executor, client);

    return {
      timestamp,
      poolTick: outcome.poolTick,
      position: outcome.tokenId
        ? { tokenId: outcome.tokenId.toString(), tickLower: outcome.tickLower, tickUpper: outcome.tickUpper, inRange: true }
        : null,
      actionTaken: true,
      action: { type: "open_position", tokenId: outcome.tokenId?.toString() ?? "", txHashes: [...wrapTxHashes, ...outcome.txHashes] },
    };
  }

  // --- Position owned: check range ---
  const inRange = pool.tick >= owned.tickLower && pool.tick < owned.tickUpper;

  if (inRange) {
    // In range, but is there idle USDT/WBNB dust worth folding back in
    // (e.g. left over from a less-precisely-sized earlier mint)? A real
    // rebalancer shouldn't leave capital sitting idle just because the
    // position itself doesn't need touching.
    const dust = await tokenBalances(client, wallet.address as Address);
    if (isDust(dust.usdt, dust.wbnb)) {
      return {
        timestamp,
        poolTick: pool.tick,
        position: { tokenId: owned.tokenId.toString(), tickLower: owned.tickLower, tickUpper: owned.tickUpper, inRange: true },
        actionTaken: false,
        skippedReason: `position #${owned.tokenId} in range: tick ${pool.tick} within [${owned.tickLower}, ${owned.tickUpper})`,
      };
    }

    // v2 fee gate: folding dust in only pays if the extra liquidity earns
    // more than the swap, approvals and increaseLiquidity cost.
    const dustBnb = Number(formatEther(dust.wbnb)) + (Number(dust.usdt) / 1e6) * wbnbPerUsdt(pool.tick);
    const positionBnb = positionValueBnb(owned.liquidity, owned.tickLower, owned.tickUpper, pool.tick);
    const [income, foldCost] = await Promise.all([recentFeeIncomeBnb(pool, owned.liquidity), gasCostBnb(DUST_FOLD_GAS_UNITS)]);
    const dustIncome = positionBnb > 0 ? income.feesBnb * (dustBnb / positionBnb) : 0;
    if (dustIncome < ACT_MULTIPLE * foldCost) {
      return {
        timestamp,
        poolTick: pool.tick,
        position: { tokenId: owned.tokenId.toString(), tickLower: owned.tickLower, tickUpper: owned.tickUpper, inRange: true },
        actionTaken: false,
        skippedReason:
          `position #${owned.tokenId} in range; ${dustBnb.toFixed(6)} BNB of idle dust left alone: ` +
          `it would earn ~${dustIncome.toExponential(2)} BNB per ${FEE_HORIZON_DAYS}d at this pool's measured fee rate, folding it in costs ~${foldCost.toFixed(6)} BNB in gas`,
      };
    }

    const dustSwap = computeOptimalSwap(dust.usdt, dust.wbnb, pool.sqrtPriceX96, owned.tickLower, owned.tickUpper);
    const swapTxHashes = await applyOptimalSwap(wallet, executor, dustSwap);
    const balAfterSwap = await tokenBalances(client, wallet.address as Address);
    const approveTxHashes = await approveNfpmForMint(executor, wallet.address as Address, balAfterSwap.usdt, balAfterSwap.wbnb);

    const increaseRes = await executor.execute({
      call: {
        address: PANCAKE_TESTNET.nfpm,
        abi: nfpmAbi,
        functionName: "increaseLiquidity",
        args: [
          {
            tokenId: owned.tokenId,
            amount0Desired: balAfterSwap.usdt,
            amount1Desired: balAfterSwap.wbnb,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: deadline(),
          },
        ],
      },
      description: `Fold ${balAfterSwap.usdt} raw USDT + ${balAfterSwap.wbnb} raw WBNB idle dust into position #${owned.tokenId} via increaseLiquidity`,
    });

    return {
      timestamp,
      poolTick: pool.tick,
      position: { tokenId: owned.tokenId.toString(), tickLower: owned.tickLower, tickUpper: owned.tickUpper, inRange: true },
      actionTaken: true,
      action: { type: "deploy_idle_dust", tokenId: owned.tokenId.toString(), txHashes: [...swapTxHashes, ...approveTxHashes, increaseRes.transactionHash] },
    };
  }

  // --- Drifted out of range ---
  // v2 fee gate: re-centring only pays if the new range would earn more in
  // fees than the move costs. Same capital, so the current liquidity is a
  // fair proxy for the new position's. If it doesn't pay, hold: an
  // out-of-range position is simply a single-asset holding, costing nothing.
  const [income, moveCost] = await Promise.all([recentFeeIncomeBnb(pool, owned.liquidity), gasCostBnb(REBALANCE_GAS_UNITS)]);
  if (income.feesBnb < ACT_MULTIPLE * moveCost) {
    return {
      timestamp,
      poolTick: pool.tick,
      position: { tokenId: owned.tokenId.toString(), tickLower: owned.tickLower, tickUpper: owned.tickUpper, inRange: false },
      actionTaken: false,
      skippedReason:
        `position #${owned.tokenId} out of range (tick ${pool.tick} outside [${owned.tickLower}, ${owned.tickUpper})), holding: ` +
        `this pool paid ~${income.feesBnb.toExponential(2)} BNB per ${FEE_HORIZON_DAYS}d to this much liquidity over the last ${income.days.toFixed(1)}d, ` +
        `a rebalance costs ~${moveCost.toFixed(6)} BNB in gas`,
    };
  }

  // --- Worth it: remove (batched) then re-mint via the shared sizing sequence ---
  const removeCalldata = [
    encodeFunctionData({
      abi: nfpmAbi,
      functionName: "decreaseLiquidity",
      args: [{ tokenId: owned.tokenId, liquidity: owned.liquidity, amount0Min: 0n, amount1Min: 0n, deadline: deadline() }],
    }),
    encodeFunctionData({
      abi: nfpmAbi,
      functionName: "collect",
      args: [{ tokenId: owned.tokenId, recipient: wallet.address, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
    }),
    encodeFunctionData({ abi: nfpmAbi, functionName: "burn", args: [owned.tokenId] }),
  ];

  const removeRes = await executor.execute({
    call: { address: PANCAKE_TESTNET.nfpm, abi: nfpmAbi, functionName: "multicall", args: [removeCalldata] },
    description: `Position #${owned.tokenId} drifted out of range (tick ${pool.tick} outside [${owned.tickLower}, ${owned.tickUpper})), decreaseLiquidity+collect+burn in one tx`,
  });

  const outcome = await sizeSwapAndMint(wallet, executor, client);

  return {
    timestamp,
    poolTick: outcome.poolTick,
    position: outcome.tokenId
      ? { tokenId: outcome.tokenId.toString(), tickLower: outcome.tickLower, tickUpper: outcome.tickUpper, inRange: true }
      : null,
    actionTaken: true,
    action: { type: "rebalance_position", tokenId: outcome.tokenId?.toString() ?? "", txHashes: [removeRes.transactionHash, ...outcome.txHashes] },
  };
}
