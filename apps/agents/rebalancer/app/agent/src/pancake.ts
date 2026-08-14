/**
 * PancakeSwap V3 (BSC Testnet) client — Factory / SwapRouter / QuoterV2 /
 * NonfungiblePositionManager.
 *
 * Every address and ABI shape below was independently verified against
 * BscScan Testnet's "Exact Match" verified source before being used here —
 * not copied from a docs table alone:
 *   - Factory, SwapRouter, WBNB: cross-checked via PancakeSwap's own
 *     dev-docs address table, then confirmed live by calling
 *     SwapRouter.WETH9() and SwapRouter.factory() on-chain and diffing
 *     against the independently-verified WBNB/Factory addresses.
 *   - NonfungiblePositionManager, QuoterV2: address taken from a docs cross
 *     reference was itself found unreliable (a WebFetch of a GitHub
 *     deployments JSON returned a SwapRouter address that didn't match the
 *     on-chain-confirmed one — small-model fetches can fabricate plausible
 *     JSON when a raw file 404s), so both were verified the same way:
 *     called factory()/WETH9() on the candidate address and diffed against
 *     the known-good Factory/WBNB. Their exact ABIs were then pulled
 *     directly from BscScan Testnet's verified "Contract ABI" panel, never
 *     assumed from memory of mainnet Uniswap V3.
 *   - The "SwapRouter" address is, on inspection of its verified source,
 *     actually named **SmartRouter** (PancakeSwap's unified V2+V3+StableSwap
 *     router) — WETH9()/factory() matching isn't sufficient proof of a
 *     contract's identity, since every PancakeSwap V3 periphery contract
 *     (Router, Quoter, NFPM, Migrator) inherits the same
 *     PeripheryImmutableState base and exposes those two getters
 *     identically. This was caught the hard way: a first real swap tx
 *     reverted near-instantly (~26k gas — a selector-not-found revert, not a
 *     logic revert) because SmartRouter's `IV3SwapRouter.ExactInputSingleParams`
 *     has NO `deadline` field (unlike classic Uniswap V3's SwapRouter) —
 *     deadline protection instead comes from wrapping the call in
 *     SmartRouter's own `multicall(uint256 deadline, bytes[] data)`
 *     overload. Fixed by re-fetching this contract's own verified ABI
 *     directly (CONTRACT NAME: SmartRouter, Exact Match) instead of trusting
 *     the WETH9/factory cross-check alone.
 *   - The only pool with real (non-zero) liquidity for WBNB/USDT across all
 *     four fee tiers is the 0.01% tier (fee=100, tickSpacing=1); the other
 *     three are uninitialized on testnet.
 */

import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  type PublicClient,
} from "viem";
import { bscTestnet } from "viem/chains";

export const PANCAKE_TESTNET = {
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as Address,
  swapRouter: "0x9a489505a00cE272eAa5e07Dba6491314CaE3796" as Address,
  quoterV2: "0xbC203d7f83677c7ed3F7acEc959963E7F4ECC5C2" as Address,
  nfpm: "0x427bF5b37357632377eCbEC9de3626C71A5396c1" as Address,
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address,
  // Venus-testnet USDT — also the token PancakeSwap's own WBNB/USDT 0.01%
  // pool is paired against on BSC Testnet (token0 in that pool).
  USDT: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c" as Address,
  pool_WBNB_USDT_1bp: "0xCed0844e421F856D2de472F9e7037f873987887C" as Address,
  FEE_1BP: 100, // 0.01% — the only WBNB/USDT tier with real testnet liquidity
} as const;

export const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);

export const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function tickSpacing() view returns (int24)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
]);

// ExactInputSingleParams confirmed via BscScan Testnet's verified ABI panel
// for THIS specific contract (CONTRACT NAME: SmartRouter, Exact Match) — no
// `deadline` field in the struct itself; deadline protection comes from the
// separate `multicall(uint256 deadline, bytes[] data)` overload below.
export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
  "function WETH9() view returns (address)",
  "function factory() view returns (address)",
]);

export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// NonfungiblePositionManager — struct shapes confirmed via BscScan
// Testnet's verified ABI panel (contract name "NonfungiblePositionManager",
// Exact Match, symbol "PCS-V3-POS").
export const nfpmAbi = parseAbi([
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) payable returns (uint256 amount0, uint256 amount1)",
  "function burn(uint256 tokenId) payable",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
  "function refundETH() payable",
  "function WETH9() view returns (address)",
  "function factory() view returns (address)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

// WBNB's own deposit()/withdraw() — used to wrap idle native BNB into a
// plain ERC20 balance up front, so the rest of the position-sizing logic
// only ever has to deal with ERC20 balanceOf/approve/transferFrom and never
// branches on "was this leg funded with native value or a token approval".
export const wbnbAbi = parseAbi([
  "function deposit() payable",
  "function withdraw(uint256 amount)",
]);

let client: PublicClient | undefined;

export function getPancakePublicClient(): PublicClient {
  client ??= createPublicClient({
    chain: bscTestnet,
    transport: http(
      process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    ),
  });
  return client;
}

export interface PoolState {
  pool: Address;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  tickSpacing: number;
  token0: Address;
  token1: Address;
  fee: number;
}

/** Always reads live — never caches — so a rebalance decision is never made on stale price. */
export async function getPoolState(): Promise<PoolState> {
  const c = getPancakePublicClient();
  const pool = PANCAKE_TESTNET.pool_WBNB_USDT_1bp;
  const [slot0, liquidity, tickSpacing, token0, token1, fee] = await Promise.all([
    c.readContract({ address: pool, abi: poolAbi, functionName: "slot0" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "tickSpacing" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "token1" }),
    c.readContract({ address: pool, abi: poolAbi, functionName: "fee" }),
  ]);
  return {
    pool,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
    liquidity,
    tickSpacing,
    token0,
    token1,
    fee,
  };
}

/**
 * Real on-chain simulated quote (QuoterV2) — never an assumed/estimated
 * price. QuoterV2's `quoteExactInputSingle` is declared `nonpayable` (it
 * "reverts" internally as part of how it computes the quote), so it must be
 * driven through `simulateContract` (eth_call) rather than `readContract`,
 * which viem's types only permit for `view`/`pure` functions.
 */
export async function quoteExactInputSingle(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<bigint> {
  const c = getPancakePublicClient();
  const { result } = await c.simulateContract({
    address: PANCAKE_TESTNET.quoterV2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee: PANCAKE_TESTNET.FEE_1BP,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return result[0];
}

/**
 * sqrt(1.0001^tick), as a plain float. This is the textbook Uniswap V3
 * tick-to-price relationship (price = 1.0001^tick, in raw/undecimaled
 * token1-per-token0 terms) evaluated with `Math.pow` rather than the
 * on-chain `TickMath.getSqrtRatioAtTick` bit-shift algorithm.
 *
 * That's a deliberate choice, not a shortcut taken carelessly: hand-porting
 * TickMath's fixed-point bit-manipulation algorithm risks introducing a
 * subtle rounding bug of our own, for a value that here is ONLY ever used to
 * *estimate* a good swap split — never to enforce a minimum. Every real mint
 * this estimate feeds into still sends `amount0Min: 0n, amount1Min: 0n` (see
 * rebalancerCore.ts), so a bad estimate can only ever cost capital
 * efficiency (leftover dust), never correctness or safety. `1.0001^tick` is
 * comfortably within `Math.pow`'s precision range for the tick magnitudes
 * this pool trades at (verified: matches the real on-chain
 * `sqrtPriceX96`-derived price to full display precision — see
 * computeOptimalSwap's usage).
 */
function sqrtRatioAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

export interface OptimalSwap {
  /** "none" when the current holdings are already close enough to the target ratio. */
  direction: "token0_to_token1" | "token1_to_token0" | "none";
  /** Raw amount of the source token (per `direction`) to swap. Zero when direction is "none". */
  amountIn: bigint;
}

/**
 * Given current holdings of token0 (USDT) and token1 (WBNB) and a target
 * [tickLower, tickUpper] range, estimate the single swap that best balances
 * them for a full-value LP mint — instead of assuming a naive 50/50 (or
 * "keep whatever we already have") split, which reliably leaves one side as
 * idle, un-deployed dust whenever the range isn't priced exactly 1:1.
 *
 * Method: convert total holdings to a common token1-equivalent value at the
 * current spot price, solve for the token0/token1 split that matches the
 * range's own required ratio (derived from the standard Uniswap V3
 * liquidity-amount formulas), then report the one swap that gets current
 * holdings to that split. Price impact of the swap itself is intentionally
 * ignored — this is a sizing estimate feeding into mint calls that always
 * carry `amountMin: 0`, so any residual imprecision shows up as a small
 * amount of leftover dust, never as a stuck or reverted transaction.
 */
export function computeOptimalSwap(
  have0: bigint,
  have1: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
): OptimalSwap {
  const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  const sqrtPa = sqrtRatioAtTick(tickLower);
  const sqrtPb = sqrtRatioAtTick(tickUpper);
  const rawPrice = sqrtP * sqrtP; // token1 raw units per token0 raw unit, current spot

  // Required amount1/amount0 ratio for ANY liquidity amount in this range,
  // given the current price sits strictly between the two bounds (always
  // true here — every range this agent mints is centered on the current
  // tick by construction).
  const ratio = (sqrtP - sqrtPa) / (1 / sqrtP - 1 / sqrtPb);

  const have0Num = Number(have0);
  const have1Num = Number(have1);
  const totalValueInToken1 = have1Num + have0Num * rawPrice;

  const targetToken0 = totalValueInToken1 / (ratio + rawPrice);
  const targetToken1 = totalValueInToken1 - targetToken0 * rawPrice;

  const deadbandFrac = 0.02; // ignore differences under ~2% of portfolio value — not worth a swap+gas
  const deadband = totalValueInToken1 * deadbandFrac;

  if (targetToken0 > have0Num) {
    // Short on token0 (USDT) relative to target — sell some token1 (WBNB) for it.
    const shortfallToken0 = targetToken0 - have0Num;
    const swapAmount1 = shortfallToken0 * rawPrice;
    if (swapAmount1 < deadband || have1 === 0n) return { direction: "none", amountIn: 0n };
    return { direction: "token1_to_token0", amountIn: BigInt(Math.floor(Math.min(swapAmount1, have1Num))) };
  } else {
    // Excess token0 relative to target — sell some of it for token1.
    const excessToken0 = have0Num - targetToken0;
    if (excessToken0 * rawPrice < deadband || have0 === 0n) return { direction: "none", amountIn: 0n };
    return { direction: "token0_to_token1", amountIn: BigInt(Math.floor(Math.min(excessToken0, have0Num))) };
  }
}
