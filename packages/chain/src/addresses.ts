/**
 * Contract addresses gathered from research (Aug 2026).
 *
 * VERIFIED = independently confirmed live on a block explorer during research.
 * UNVERIFIED = surfaced via a summarizing fetch tool and NOT yet independently
 * cross-checked — re-verify against BscScan/Etherscan/Basescan directly before
 * this address ever signs a real transaction (see plan Verification section).
 */

export const BSC_MAINNET_CHAIN_ID = 56;
export const BSC_TESTNET_CHAIN_ID = 97;

export const ERC8004_ADDRESSES = {
  [BSC_MAINNET_CHAIN_ID]: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", // VERIFIED on BscScan
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", // UNVERIFIED
  },
  [BSC_TESTNET_CHAIN_ID]: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e", // UNVERIFIED
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713", // UNVERIFIED
  },
} as const;

export const ALTANA_KEYSTORE_ADDRESSES = {
  [BSC_MAINNET_CHAIN_ID]: {
    keyStore: "0x6572427ED530BadcF7375Cf9A4709D8d2b0E7E0a", // VERIFIED live + "Exact Match" on BscScan
    keyStoreController: "0x0834Ee2C9BdC3E3efF0a2dC34393D4B0e546A555", // UNVERIFIED
  },
} as const;

/**
 * PancakeSwap V3, BSC Testnet — every address here independently confirmed
 * live during the Rebalancer/Grid Trading agents' build (BscScan Testnet's
 * own verified "Contract ABI" panel, cross-checked by calling
 * WETH9()/factory() on-chain and diffing against the known-good WBNB/Factory
 * addresses; see apps/agents/rebalancer/app/agent/src/pancake.ts for the
 * full verification notes, including the discovery that the router is
 * PancakeSwap's SmartRouter, not the classic Uniswap V3 SwapRouter).
 *
 * This replaces an earlier `PANCAKESWAP_V3_MAINNET` block that was marked
 * UNVERIFIED ("sourced via reader-proxy fetch") and, on cross-check against
 * the addresses actually verified above, turned out to have wrong labels —
 * its "tickLens" entry was in fact the real testnet SmartRouter address.
 * No independently-verified PancakeSwap V3 MAINNET address set exists in
 * this codebase yet; add one the same way (on-chain cross-check, not a
 * single fetched docs table) before any mainnet-facing code needs it.
 */
export const PANCAKESWAP_V3_TESTNET = {
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  smartRouter: "0x9a489505a00cE272eAa5e07Dba6491314CaE3796", // VERIFIED: CONTRACT NAME "SmartRouter", Exact Match
  quoterV2: "0xbC203d7f83677c7ed3F7acEc959963E7F4ECC5C2", // VERIFIED: CONTRACT NAME "QuoterV2", Exact Match
  nonfungiblePositionManager: "0x427bF5b37357632377eCbEC9de3626C71A5396c1", // VERIFIED: CONTRACT NAME "NonfungiblePositionManager", Exact Match, symbol "PCS-V3-POS"
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", // VERIFIED on-chain: name="Wrapped BNB", symbol="WBNB", decimals=18
} as const;

/** Venus-testnet USDT — the token PancakeSwap's own WBNB/USDT pools on BSC Testnet are paired against. */
export const VENUS_USDT_TESTNET = "0xA11c8D9DC9b66E209Ef60F0C8D969D3CD988782c" as const;

export const BSC_TESTNET_FAUCET_URL = "https://www.bnbchain.org/en/testnet-faucet";
export const SCAN8004_API_BASE = "https://8004scan.io/api/v1/public";

/**
 * Venus Protocol Core Pool, BSC Testnet. Each address independently verified
 * live on testnet.bscscan.com during research (real transaction history,
 * correct token-tracker labels) — not taken on faith from a single source.
 */
export const VENUS_TESTNET = {
  comptroller: "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D", // VERIFIED: active Comptroller (Enter Markets / Set Collateral Factor calls)
  poolLens: "0x166C45bCCE54166Ecf9bCDF8d2EC562014A06048", // VERIFIED: real contract; no tx history expected (pure view/lens)
  vBNB: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c", // VERIFIED: "BEP-20: Venus BNB (vBNB)", real Mint/Redeem activity
  vUSDT: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A", // VERIFIED: "BEP-20: Venus USDT (vUSDT)", real Borrow/RepayBorrow activity
} as const;
