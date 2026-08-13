import { createPublicClient, http, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";

/**
 * BSC mainnet: read-only discovery (8004scan-indexed third-party agents,
 * Altana Keystore verification for mainnet-migrated agents of ours).
 * BSC testnet: read-write for our own agents while under active development.
 * Override RPC via env if the public data-seed nodes get rate-limited during
 * a live demo.
 */

export function getBscMainnetClient(): PublicClient {
  return createPublicClient({
    chain: bsc,
    transport: http(process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.binance.org"),
  });
}

export function getBscTestnetClient(): PublicClient {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(
      process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
    ),
  });
}
