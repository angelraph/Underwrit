/**
 * Venus Protocol (Compound v2 fork) client — BSC Testnet Core Pool.
 *
 * Same verified addresses as the Health Factor Guardian's copy (each
 * independently confirmed live on testnet.bscscan.com — see that project's
 * venus.ts for the verification notes). Duplicated here for the same reason:
 * this agent is its own standalone deploy unit and cannot reach outside its
 * own directory tree.
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
  vBNB: "0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c" as Address,
  vUSDT: "0xb7526572FFE56AB9D7489838Bf2E18e3323b441A" as Address,
} as const;

/** vBNB (native-asset market) — mint/redeem take BNB value directly, no ERC20 approve. */
export const vBnbAbi = parseAbi([
  "function mint() payable",
  "function redeem(uint256 redeemTokens) returns (uint256)",
  "function redeemUnderlying(uint256 redeemAmount) returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function supplyRatePerBlock() view returns (uint256)",
]);

/** vBEP20 markets (e.g. vUSDT) — amounts as uint256, requires underlying ERC20 approval to mint. */
export const vBep20Abi = parseAbi([
  "function mint(uint256 mintAmount) returns (uint256)",
  "function redeem(uint256 redeemTokens) returns (uint256)",
  "function redeemUnderlying(uint256 redeemAmount) returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function supplyRatePerBlock() view returns (uint256)",
  "function underlying() view returns (address)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

let client: PublicClient | undefined;

export function getVenusPublicClient(): PublicClient {
  client ??= createPublicClient({
    chain: bscTestnet,
    transport: http(
      process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    ),
  });
  return client;
}

/**
 * Measure the network's actual current block time from two real, recent
 * blocks rather than trusting a hardcoded "blocks per year" constant — BSC's
 * block time has changed across upgrades, and a stale constant would quietly
 * mis-annualize every rate computed from it.
 */
export async function getBlocksPerYear(sampleWindow = 2000): Promise<number> {
  const c = getVenusPublicClient();
  const latest = await c.getBlock();
  const older = await c.getBlock({ blockNumber: latest.number - BigInt(sampleWindow) });
  const blockTimeSec = Number(latest.timestamp - older.timestamp) / sampleWindow;
  const secondsPerYear = 365.25 * 24 * 60 * 60;
  return secondsPerYear / blockTimeSec;
}

/** Compound-style compounding APY from a per-block supply rate mantissa (1e18-scaled). */
export async function getSupplyApyPct(vToken: Address, abi: typeof vBnbAbi | typeof vBep20Abi): Promise<number> {
  const c = getVenusPublicClient();
  const ratePerBlock = await c.readContract({
    address: vToken,
    abi,
    functionName: "supplyRatePerBlock",
  });
  const blocksPerYear = await getBlocksPerYear();
  const ratePerBlockDecimal = Number(ratePerBlock) / 1e18;
  return (Math.pow(1 + ratePerBlockDecimal, blocksPerYear) - 1) * 100;
}
