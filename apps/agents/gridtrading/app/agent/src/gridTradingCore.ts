/**
 * Grid Trading — holds a target WBNB/USDT allocation on the PancakeSwap V3
 * 0.01%-fee WBNB/USDT pool (BSC Testnet) that steps up as price falls
 * through a fixed ladder of levels and steps down as price rises through
 * it, executing real spot swaps whenever the current allocation drifts far
 * enough from the level's target to be worth the gas.
 *
 * Same discipline as the other three reference agents: this is fixed code,
 * never an LLM tool. All signing lives in `signing.ts`.
 *
 * Design — deliberately stateless (no local state file, matching the "the
 * NFT is the state" pattern from the Rebalancer, adapted here to "the
 * wallet's own token balances are the state"):
 *   - The grid itself is a FIXED ladder of absolute tick levels
 *     (GRID_CENTER_TICK ± k * LEVEL_SPACING_TICKS for k in
 *     [-N_LEVELS, N_LEVELS]) — anchored to real, round tick numbers chosen
 *     from the pool's actual price at build time, not re-derived from
 *     "current tick" on every run (which would make the grid drift with
 *     price instead of trading against it).
 *   - Each level has a target WBNB allocation fraction of total portfolio
 *     value: 100% WBNB at the bottom level (cheapest price — fully bought
 *     in), 0% WBNB at the top level (most expensive — fully sold out), and
 *     a straight-line step between, so target allocation only ever needs
 *     the CURRENT tick and the wallet's CURRENT balances to compute — no
 *     memory of a "last observed level" required.
 *   - Every run: read the current tick, compute the target WBNB value in
 *     USDT-equivalent terms, compare to what's actually held, and — if the
 *     gap exceeds half a level's worth (a deadband, so a single price
 *     wiggle within one level doesn't trigger a trade) — swap exactly
 *     enough to close it. Rising price sells into strength; falling price
 *     buys the dip. Classic grid behavior, derived fresh from chain state
 *     every time.
 */

import { getWallet } from "@bnbagent/studio-runtime/wallet";
import type { WalletProvider } from "@bnbagent/sdk";
import { encodeFunctionData, formatEther, parseEther, type Address, type PublicClient } from "viem";
import {
  erc20Abi,
  getPancakePublicClient,
  getPoolState,
  PANCAKE_TESTNET,
  quoteExactInputSingle,
  swapRouterAbi,
  wbnbAbi,
  type PoolState,
} from "./pancake.js";

// Anchored to the pool's real tick at build time (~190104, 2026-08-14) —
// a fixed ladder, not re-centered on "current tick" each run (that would
// make the grid chase price instead of trading against it).
const GRID_CENTER_TICK = 190000;
const LEVEL_SPACING_TICKS = 500; // ~5% per level, consistent with the Rebalancer's chosen granularity
const N_LEVELS = 5; // band = center ± 2500 ticks (~±22%) — wide given this thin pool's observed volatility

const RESERVE_BNB = parseEther("0.01"); // always keep this much native for gas
const SLIPPAGE_BPS = 500n; // 5%
const MIN_TRADE_USDT_RAW = 500_000n; // ~0.5 USDT — below this, not worth a swap's gas

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 600);
}

type Executor = ReturnType<WalletProvider["makeExecutor"]>;

/** Which fixed grid level the current tick falls in, clamped to the ladder's ends. */
function currentLevel(tick: number): number {
  const raw = (tick - GRID_CENTER_TICK) / LEVEL_SPACING_TICKS;
  return Math.max(-N_LEVELS, Math.min(N_LEVELS, raw));
}

/** Target fraction of total portfolio value held as WBNB at a given (possibly fractional) level. */
function targetWbnbFraction(level: number): number {
  return Math.max(0, Math.min(1, 0.5 - level / (2 * N_LEVELS)));
}

async function tokenBalances(client: PublicClient, owner: Address): Promise<{ usdt: bigint; wbnb: bigint }> {
  const [usdt, wbnb] = await Promise.all([
    client.readContract({ address: PANCAKE_TESTNET.USDT, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
    client.readContract({ address: PANCAKE_TESTNET.WBNB, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
  ]);
  return { usdt, wbnb };
}

async function wrapNative(executor: Executor, amount: bigint): Promise<string[]> {
  if (amount === 0n) return [];
  const res = await executor.execute({
    call: { address: PANCAKE_TESTNET.WBNB, abi: wbnbAbi, functionName: "deposit", args: [] },
    value: amount,
    description: `Wrap ${formatEther(amount)} native BNB into WBNB`,
  });
  return [res.transactionHash];
}

async function executeSwap(wallet: WalletProvider, executor: Executor, tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<string[]> {
  const quotedOut = await quoteExactInputSingle(tokenIn, tokenOut, amountIn);
  const amountOutMinimum = (quotedOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;

  const approveRes = await executor.execute({
    call: { address: tokenIn, abi: erc20Abi, functionName: "approve", args: [PANCAKE_TESTNET.swapRouter, amountIn] },
    description: `Approve SmartRouter to pull ${amountIn} raw units of ${tokenIn} for a grid trade`,
  });

  const swapCalldata = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [{ tokenIn, tokenOut, fee: PANCAKE_TESTNET.FEE_1BP, recipient: wallet.address, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
  });
  const swapRes = await executor.execute({
    call: { address: PANCAKE_TESTNET.swapRouter, abi: swapRouterAbi, functionName: "multicall", args: [deadline(), [swapCalldata]] },
    description: `Swap ${amountIn} raw units ${tokenIn} -> ${tokenOut} (quoted ${quotedOut}, min ${amountOutMinimum})`,
  });

  return [approveRes.transactionHash, swapRes.transactionHash];
}

export interface GridCheckResult {
  timestamp: string;
  poolTick: number;
  level: number;
  targetWbnbFraction: number;
  actualWbnbFraction: number;
  actionTaken: boolean;
  action?: {
    type: "wrap_native" | "buy_wbnb" | "sell_wbnb";
    txHashes: string[];
  };
  skippedReason?: string;
}

export async function checkAndTrade(): Promise<GridCheckResult> {
  const wallet = getWallet();
  const client = getPancakePublicClient();
  const timestamp = new Date().toISOString();
  const pool: PoolState = await getPoolState();
  const executor = wallet.makeExecutor({ client });

  // Wrap any idle native BNB above the gas reserve first — this is what
  // funds the very first trade, and also naturally absorbs any later
  // manual top-up without needing separate handling.
  const nativeBalance = await client.getBalance({ address: wallet.address });
  const wrapAmount = nativeBalance > RESERVE_BNB ? nativeBalance - RESERVE_BNB : 0n;
  const wrapTxHashes = await wrapNative(executor, wrapAmount);

  const bal = await tokenBalances(client, wallet.address as Address);
  const level = currentLevel(pool.tick);
  const target = targetWbnbFraction(level);

  // Convert everything to a common USDT-raw-equivalent value at current spot.
  const totalValueUsdtRaw = Number(bal.usdt) + Number(bal.wbnb) / pool.rawPrice;
  const actualWbnbValueUsdtRaw = Number(bal.wbnb) / pool.rawPrice;
  const actualFraction = totalValueUsdtRaw > 0 ? actualWbnbValueUsdtRaw / totalValueUsdtRaw : 0;

  const targetWbnbValueUsdtRaw = totalValueUsdtRaw * target;
  const gapUsdtRaw = targetWbnbValueUsdtRaw - actualWbnbValueUsdtRaw; // >0 => need to buy more WBNB

  // Deadband: half a grid level's worth of the portfolio — a single price
  // wiggle within one level shouldn't trigger a trade.
  const levelStepUsdtRaw = totalValueUsdtRaw / (2 * N_LEVELS);
  const deadbandUsdtRaw = levelStepUsdtRaw * 0.5;

  const base = {
    timestamp,
    poolTick: pool.tick,
    level,
    targetWbnbFraction: target,
    actualWbnbFraction: actualFraction,
  };

  if (wrapTxHashes.length > 0) {
    // A real wrap happened — report it as this run's real action in its
    // own right (with its real tx hash) rather than letting it disappear
    // into a "no trade" skip just because the deadband check below might
    // find nothing further to do this run. The buy/sell decision itself
    // gets evaluated fresh next run against the now-wrapped balance.
    return { ...base, actionTaken: true, action: { type: "wrap_native", txHashes: wrapTxHashes } };
  }

  if (Math.abs(gapUsdtRaw) < deadbandUsdtRaw || Math.abs(gapUsdtRaw) < Number(MIN_TRADE_USDT_RAW)) {
    return {
      ...base,
      actionTaken: false,
      skippedReason: `level ${level.toFixed(2)} target ${(target * 100).toFixed(0)}% WBNB vs actual ${(actualFraction * 100).toFixed(0)}% — within deadband, no trade`,
    };
  }

  if (gapUsdtRaw > 0) {
    // Need more WBNB — buy with USDT (bounded by what we actually hold).
    const buyAmountUsdtRaw = BigInt(Math.floor(Math.min(gapUsdtRaw, Number(bal.usdt))));
    if (buyAmountUsdtRaw < MIN_TRADE_USDT_RAW) {
      return { ...base, actionTaken: false, skippedReason: `target wants more WBNB but only ${bal.usdt} raw USDT available — below the minimum trade size` };
    }
    const swapTxHashes = await executeSwap(wallet, executor, PANCAKE_TESTNET.USDT, PANCAKE_TESTNET.WBNB, buyAmountUsdtRaw);
    return { ...base, actionTaken: true, action: { type: "buy_wbnb", txHashes: swapTxHashes } };
  } else {
    // Too much WBNB for this level — sell some into USDT.
    const sellAmountWbnbRaw = BigInt(Math.floor(Math.min(-gapUsdtRaw * pool.rawPrice, Number(bal.wbnb))));
    if (sellAmountWbnbRaw === 0n) {
      return { ...base, actionTaken: false, skippedReason: `target wants less WBNB but none available to sell` };
    }
    const swapTxHashes = await executeSwap(wallet, executor, PANCAKE_TESTNET.WBNB, PANCAKE_TESTNET.USDT, sellAmountWbnbRaw);
    return { ...base, actionTaken: true, action: { type: "sell_wbnb", txHashes: swapTxHashes } };
  }
}
