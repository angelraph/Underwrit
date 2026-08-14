import { parseAbi } from "viem";

/**
 * PancakeSwap V3 — read-only surface for the marketplace's own use
 * (Liquidity Opportunities screen). See `PANCAKESWAP_V3_TESTNET` in
 * addresses.ts for the verification notes on every address this pairs
 * with. Writes (swap, mint, etc.) live in each agent's own local copy of
 * this ABI, never here — this package is read-only by convention (see
 * altana-keystore.ts's identical note).
 */
export const pancakeV3FactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);

export const pancakeV3PoolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function tickSpacing() view returns (int24)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

/** Read-only surface of NonfungiblePositionManager — enough to inspect a wallet's own LP position(s). */
export const pancakeV3NfpmAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

/** PancakeSwap V3's four standard fee tiers, in basis-points-of-a-basis-point (hundredths of a bip). */
export const PANCAKESWAP_V3_FEE_TIERS = [100, 500, 2500, 10000] as const;

export const FEE_TIER_LABELS: Record<number, string> = {
  100: "0.01%",
  500: "0.05%",
  2500: "0.25%",
  10000: "1%",
};
