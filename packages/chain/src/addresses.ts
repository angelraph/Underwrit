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

export const PANCAKESWAP_V3_MAINNET = {
  factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  poolDeployer: "0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9",
  swapRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
  nonfungiblePositionManager: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  quoterV2: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997",
  tickLens: "0x9a489505a00cE272eAa5e07Dba6491314CaE3796",
  multicall: "0xac1cE734566f390A94b00eb9bf561c2625BF44ea",
  smartRouter: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
  masterChefV3: "0x556B9306565093C855AEA9AE92A594704c2Cd59e",
  // UNVERIFIED — sourced via reader-proxy fetch, not a direct render. Cross-check
  // against developer.pancakeswap.finance/contracts/v3/addresses + BscScan.
} as const;

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
