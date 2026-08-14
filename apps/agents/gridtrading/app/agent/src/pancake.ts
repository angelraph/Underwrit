/**
 * PancakeSwap V3 (BSC Testnet) client — Factory / SmartRouter / QuoterV2,
 * WBNB/USDT 0.01% fee-tier pool.
 *
 * Same verified addresses and ABI shapes as the Rebalancer agent's copy
 * (each independently confirmed against BscScan Testnet's own "Exact
 * Match" verified source before use — see that project's pancake.ts for
 * the full verification notes, including the SmartRouter-vs-classic-
 * SwapRouter discovery). Duplicated here for the same deploy-isolation
 * reason as every other agent's local copy of its protocol bindings: this
 * agent is its own standalone deploy unit and cannot reach outside its own
 * directory tree.
 *
 * Grid Trading only needs spot swaps (no LP position management), so this
 * is a smaller surface than the Rebalancer's copy — no
 * NonfungiblePositionManager here.
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
  swapRouter: "0x9a489505a00cE272eAa5e07Dba6491314CaE3796" as Address, // PancakeSwap SmartRouter (verified CONTRACT NAME on BscScan Testnet)
  quoterV2: "0xbC203d7f83677c7ed3F7acEc959963E7F4ECC5C2" as Address,
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address,
  USDT: "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c" as Address, // Venus-testnet USDT — token0 in the pool below
  pool_WBNB_USDT_1bp: "0xCed0844e421F856D2de472F9e7037f873987887C" as Address,
  FEE_1BP: 100, // 0.01% — the only WBNB/USDT tier with real testnet liquidity
} as const;

export const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
]);

// SmartRouter's exactInputSingle has NO deadline field of its own —
// deadline protection comes from wrapping the call in SmartRouter's own
// multicall(uint256 deadline, bytes[] data) overload instead (verified via
// BscScan Testnet's own ABI panel for this contract; CONTRACT NAME:
// SmartRouter, not the classic Uniswap V3 SwapRouter shape).
export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

export const quoterV2Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

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
  tick: number;
  sqrtPriceX96: bigint;
  rawPrice: number; // token1 (WBNB) raw units per token0 (USDT) raw unit, current spot
}

/** Always reads live — never caches — so a grid decision is never made on stale price. */
export async function getPoolState(): Promise<PoolState> {
  const c = getPancakePublicClient();
  const slot0 = await c.readContract({
    address: PANCAKE_TESTNET.pool_WBNB_USDT_1bp,
    abi: poolAbi,
    functionName: "slot0",
  });
  const sqrtP = Number(slot0[0]) / 2 ** 96;
  return { tick: slot0[1], sqrtPriceX96: slot0[0], rawPrice: sqrtP * sqrtP };
}

/** Real on-chain simulated quote (QuoterV2) — never an assumed/estimated price. */
export async function quoteExactInputSingle(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<bigint> {
  const c = getPancakePublicClient();
  const { result } = await c.simulateContract({
    address: PANCAKE_TESTNET.quoterV2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn, tokenOut, amountIn, fee: PANCAKE_TESTNET.FEE_1BP, sqrtPriceLimitX96: 0n }],
  });
  return result[0];
}
