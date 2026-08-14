import {
  getBscTestnetClient,
  pancakeV3FactoryAbi,
  pancakeV3PoolAbi,
  PANCAKESWAP_V3_TESTNET,
  PANCAKESWAP_V3_FEE_TIERS,
  FEE_TIER_LABELS,
  VENUS_USDT_TESTNET,
} from "@underwrit/chain";
import type { Address } from "viem";

/**
 * Real PancakeSwap V3 pool state for the WBNB/USDT pair on BSC Testnet,
 * read live across every standard fee tier — no subgraph, no historical
 * volume/imbalance estimate (those need an indexer this project doesn't
 * have; inventing plausible-looking numbers for them is exactly the kind
 * of fabrication this project has deliberately avoided everywhere else).
 *
 * What's real and computable from a single on-chain read: which tiers
 * actually have a pool with real liquidity right now, and which are
 * completely uninitialized. That's a genuine, checkable signal — an
 * uninitialized tier means literally zero LPs are competing for that
 * tier's fee revenue on this pair yet.
 */
export interface FeeTierState {
  fee: number;
  feeLabel: string;
  poolAddress: Address;
  exists: boolean;
  liquidity: bigint | null;
  tick: number | null;
}

export async function getWbnbUsdtFeeTierStates(): Promise<FeeTierState[]> {
  const client = getBscTestnetClient();

  const results = await Promise.all(
    PANCAKESWAP_V3_FEE_TIERS.map(async (fee) => {
      const poolAddress = await client.readContract({
        address: PANCAKESWAP_V3_TESTNET.factory,
        abi: pancakeV3FactoryAbi,
        functionName: "getPool",
        args: [PANCAKESWAP_V3_TESTNET.WBNB, VENUS_USDT_TESTNET, fee],
      });

      const zeroAddress = "0x0000000000000000000000000000000000000000";
      if (poolAddress.toLowerCase() === zeroAddress) {
        return { fee, feeLabel: FEE_TIER_LABELS[fee], poolAddress, exists: false, liquidity: null, tick: null };
      }

      const [liquidity, slot0] = await Promise.all([
        client.readContract({ address: poolAddress, abi: pancakeV3PoolAbi, functionName: "liquidity" }),
        client.readContract({ address: poolAddress, abi: pancakeV3PoolAbi, functionName: "slot0" }),
      ]);

      // A pool contract can exist (deployed by getPool's CREATE2 logic) but
      // never have been initialized with a starting price — MIN_TICK is
      // TickMath's sentinel for "never initialized", not a real price.
      const MIN_TICK = -887272;
      const initialized = slot0[1] !== MIN_TICK && liquidity > BigInt(0);

      return {
        fee,
        feeLabel: FEE_TIER_LABELS[fee],
        poolAddress,
        exists: initialized,
        liquidity: initialized ? liquidity : null,
        tick: initialized ? slot0[1] : null,
      };
    })
  );

  return results;
}
