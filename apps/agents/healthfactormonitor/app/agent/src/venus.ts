/**
 * Venus Protocol (Compound v2 fork) client — BSC Testnet Core Pool.
 *
 * Addresses are duplicated here (rather than imported from the Underwrit
 * monorepo's shared packages/chain) on purpose: this agent project is its own
 * standalone pnpm workspace, bundled and deployed in isolation by `bag deploy`
 * — it cannot reach outside its own directory tree. Each address below was
 * independently verified live on testnet.bscscan.com (real Enter
 * Markets/Borrow/RepayBorrow transaction history, correct token-tracker
 * labels) before being hardcoded — see packages/chain/src/addresses.ts in the
 * monorepo root for the same values with the verification notes.
 *
 * Only the standard Compound-fork ABI surface is used, not the full Diamond
 * facet set.
 */

import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  type PublicClient,
} from "viem";
import { bscTestnet } from "viem/chains";

export const VENUS_TESTNET = {
  comptroller: "0x94d1820b2D1c7c7452A163983Dc888CEC546b77D" as Address,
  poolLens: "0x166C45bCCE54166Ecf9bCDF8d2EC562014A06048" as Address,
  vBNB: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c" as Address,
  vUSDT: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A" as Address,
} as const;

export const venusComptrollerAbi = parseAbi([
  "function getAccountLiquidity(address account) view returns (uint256 err, uint256 liquidity, uint256 shortfall)",
  "function enterMarkets(address[] vTokens) returns (uint256[])",
  "function markets(address vToken) view returns (bool isListed, uint256 collateralFactorMantissa, bool isVenus)",
  "function getAssetsIn(address account) view returns (address[])",
]);

/** vBNB (native-asset market) — mint/repay take BNB value directly, no ERC20 approve. */
export const vBnbAbi = parseAbi([
  "function mint() payable",
  "function repayBorrow() payable",
  "function borrow(uint256 borrowAmount) returns (uint256)",
  "function borrowBalanceStored(address account) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
]);

/** vBEP20 markets (e.g. vUSDT) — amounts as uint256, requires underlying ERC20 approval first. */
export const vBep20Abi = parseAbi([
  "function mint(uint256 mintAmount) returns (uint256)",
  "function repayBorrow(uint256 repayAmount) returns (uint256)",
  "function borrow(uint256 borrowAmount) returns (uint256)",
  "function borrowBalanceStored(address account) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function underlying() view returns (address)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

let client: PublicClient | undefined;

/** Shared read client for BSC testnet. Override RPC via BSC_TESTNET_RPC_URL if the default gets rate-limited. */
export function getVenusPublicClient(): PublicClient {
  client ??= createPublicClient({
    chain: bscTestnet,
    transport: http(
      process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    ),
  });
  return client;
}

export interface AccountLiquidity {
  /** true when the Comptroller call itself errored (error code != 0) — treat the position as unknown, not healthy. */
  errored: boolean;
  /** USD, 18-decimal fixed point: spare borrowing capacity. 0 when in shortfall. */
  liquidityUsd: bigint;
  /** USD, 18-decimal fixed point: amount by which the account is already underwater. 0 when healthy. */
  shortfallUsd: bigint;
}

/** Raw Comptroller.getAccountLiquidity — the same "how safe is this account" check Venus's own liquidation bots watch. */
export async function getAccountLiquidity(account: Address): Promise<AccountLiquidity> {
  const [error, liquidity, shortfall] = await getVenusPublicClient().readContract({
    address: VENUS_TESTNET.comptroller,
    abi: venusComptrollerAbi,
    functionName: "getAccountLiquidity",
    args: [account],
  });
  return { errored: error !== 0n, liquidityUsd: liquidity, shortfallUsd: shortfall };
}

export async function getMarketsEntered(account: Address): Promise<Address[]> {
  return getVenusPublicClient().readContract({
    address: VENUS_TESTNET.comptroller,
    abi: venusComptrollerAbi,
    functionName: "getAssetsIn",
    args: [account],
  }) as Promise<Address[]>;
}

export async function getVUsdtBorrowBalance(account: Address): Promise<bigint> {
  return getVenusPublicClient().readContract({
    address: VENUS_TESTNET.vUSDT,
    abi: vBep20Abi,
    functionName: "borrowBalanceStored",
    args: [account],
  });
}

export async function getVUsdtUnderlying(): Promise<Address> {
  return getVenusPublicClient().readContract({
    address: VENUS_TESTNET.vUSDT,
    abi: vBep20Abi,
    functionName: "underlying",
  });
}
