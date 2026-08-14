import {
  getBscTestnetClient,
  VENUS_TESTNET,
  vBnbAbi,
  vBep20Abi,
  venusComptrollerAbi,
  PANCAKESWAP_V3_TESTNET,
  pancakeV3PoolAbi,
  pancakeV3NfpmAbi,
} from "@underwrit/chain";
import { formatEther, parseEther, type Address } from "viem";

/**
 * Live, gas-free dry runs of each reference agent's real decision logic —
 * not a replay of historical stats. Every read here uses the exact same
 * verified contracts/addresses the deployed agent itself signs against
 * (see each agent's own source under apps/agents for the original — this
 * is the same logic re-run read-only against the agent's
 * real wallet). Nothing here ever signs or spends — it's the honest
 * "what would this agent do if you hired it this second" answer, computed
 * fresh every time the page loads, never cached, never faked.
 */

// --- Health Factor Guardian ---

export type RiskTier = "HEALTHY" | "MODERATE" | "AT_RISK" | "UNDERWATER";

export interface HealthFactorTrial {
  timestamp: string;
  tier: RiskTier;
  liquidityUsd: string;
  shortfallUsd: string;
  wouldAct: boolean;
  reasoning: string;
}

function toDecimalString(raw: bigint, decimals = 18): string {
  const whole = raw / BigInt(10) ** BigInt(decimals);
  const frac = raw % BigInt(10) ** BigInt(decimals);
  return `${whole}.${frac.toString().padStart(decimals, "0").slice(0, 4)}`;
}

export async function runHealthFactorTrial(agentWallet: Address): Promise<HealthFactorTrial> {
  const client = getBscTestnetClient();
  const [err, liquidity, shortfall] = await client.readContract({
    address: VENUS_TESTNET.comptroller,
    abi: venusComptrollerAbi,
    functionName: "getAccountLiquidity",
    args: [agentWallet],
  });

  const errored = err !== BigInt(0);
  const safetyBufferUsd = 1; // matches the deployed guardian's own default
  const ONE_USD = BigInt(10) ** BigInt(18);
  const buffer = BigInt(Math.round(safetyBufferUsd * 1_000_000)) * (ONE_USD / BigInt(1_000_000));

  let tier: RiskTier;
  if (errored) tier = "AT_RISK";
  else if (shortfall > BigInt(0)) tier = "UNDERWATER";
  else if (liquidity < buffer) tier = "AT_RISK";
  else if (liquidity < buffer * BigInt(3)) tier = "MODERATE";
  else tier = "HEALTHY";

  const wouldAct = tier === "AT_RISK" || tier === "UNDERWATER";

  return {
    timestamp: new Date().toISOString(),
    tier,
    liquidityUsd: toDecimalString(liquidity),
    shortfallUsd: toDecimalString(shortfall),
    wouldAct,
    reasoning: wouldAct
      ? `Position is ${tier} right now (${toDecimalString(liquidity)} USD spare liquidity) — the guardian would repay on its next real check`
      : `Position is ${tier} (${toDecimalString(liquidity)} USD spare liquidity, ${(safetyBufferUsd * 3).toFixed(0)} USD buffer for HEALTHY) — no action needed right now`,
  };
}

// --- Yield Router ---

export interface YieldTrial {
  timestamp: string;
  vBnbApyPct: number;
  vUsdtApyPct: number;
  bestMarket: string;
  wouldAct: boolean;
  reasoning: string;
}

async function getBlocksPerYear(sampleWindow = 2000): Promise<number> {
  const c = getBscTestnetClient();
  const latest = await c.getBlock();
  const older = await c.getBlock({ blockNumber: latest.number - BigInt(sampleWindow) });
  const blockTimeSec = Number(latest.timestamp - older.timestamp) / sampleWindow;
  return (365.25 * 24 * 60 * 60) / blockTimeSec;
}

async function getSupplyApyPct(vToken: Address, abi: typeof vBnbAbi | typeof vBep20Abi, blocksPerYear: number): Promise<number> {
  const c = getBscTestnetClient();
  const ratePerBlock = await c.readContract({ address: vToken, abi, functionName: "supplyRatePerBlock" });
  const ratePerBlockDecimal = Number(ratePerBlock) / 1e18;
  return (Math.pow(1 + ratePerBlockDecimal, blocksPerYear) - 1) * 100;
}

export async function runYieldTrial(agentWallet: Address): Promise<YieldTrial> {
  const client = getBscTestnetClient();
  const blocksPerYear = await getBlocksPerYear();
  const [bnbApy, usdtApy] = await Promise.all([
    getSupplyApyPct(VENUS_TESTNET.vBNB, vBnbAbi, blocksPerYear),
    getSupplyApyPct(VENUS_TESTNET.vUSDT, vBep20Abi, blocksPerYear),
  ]);
  const bestMarket = bnbApy >= usdtApy ? "vBNB" : "vUSDT";
  const RESERVE = parseEther("0.05");

  if (bestMarket !== "vBNB") {
    return {
      timestamp: new Date().toISOString(),
      vBnbApyPct: bnbApy,
      vUsdtApyPct: usdtApy,
      bestMarket,
      wouldAct: false,
      reasoning: `vUSDT currently wins (${usdtApy.toFixed(2)}%), but this agent has no BNB->USDT swap path wired yet — it would hold rather than fake a cross-asset move`,
    };
  }

  const nativeBalance = await client.getBalance({ address: agentWallet });
  const wouldAct = nativeBalance > RESERVE;
  return {
    timestamp: new Date().toISOString(),
    vBnbApyPct: bnbApy,
    vUsdtApyPct: usdtApy,
    bestMarket,
    wouldAct,
    reasoning: wouldAct
      ? `vBNB wins at a real ${bnbApy.toFixed(2)}% supply APY — would supply ${formatEther(nativeBalance - RESERVE)} idle BNB right now`
      : `vBNB wins (${bnbApy.toFixed(2)}%) but no idle BNB above its gas reserve to supply`,
  };
}

// --- Rebalancer ---

export interface RebalancerTrial {
  timestamp: string;
  poolTick: number;
  position: { tokenId: string; tickLower: number; tickUpper: number } | null;
  inRange: boolean | null;
  wouldAct: boolean;
  reasoning: string;
}

export async function runRebalancerTrial(agentWallet: Address): Promise<RebalancerTrial> {
  const client = getBscTestnetClient();
  const count = await client.readContract({
    address: PANCAKESWAP_V3_TESTNET.nonfungiblePositionManager,
    abi: pancakeV3NfpmAbi,
    functionName: "balanceOf",
    args: [agentWallet],
  });

  const pool = await client.readContract({
    address: PANCAKESWAP_V3_TESTNET.wbnbUsdtPool001Pct, // WBNB/USDT 0.01% — the only tier with real testnet liquidity
    abi: pancakeV3PoolAbi,
    functionName: "slot0",
  });
  const tick = pool[1];

  if (count === BigInt(0)) {
    return {
      timestamp: new Date().toISOString(),
      poolTick: tick,
      position: null,
      inRange: null,
      wouldAct: true,
      reasoning: "No position open — the agent would open one centered on the current price",
    };
  }

  const tokenId = await client.readContract({
    address: PANCAKESWAP_V3_TESTNET.nonfungiblePositionManager,
    abi: pancakeV3NfpmAbi,
    functionName: "tokenOfOwnerByIndex",
    args: [agentWallet, BigInt(0)],
  });
  const pos = await client.readContract({
    address: PANCAKESWAP_V3_TESTNET.nonfungiblePositionManager,
    abi: pancakeV3NfpmAbi,
    functionName: "positions",
    args: [tokenId],
  });
  const tickLower = pos[5];
  const tickUpper = pos[6];
  const inRange = tick >= tickLower && tick < tickUpper;

  return {
    timestamp: new Date().toISOString(),
    poolTick: tick,
    position: { tokenId: tokenId.toString(), tickLower, tickUpper },
    inRange,
    wouldAct: !inRange,
    reasoning: inRange
      ? `Position #${tokenId} is in range (tick ${tick} within [${tickLower}, ${tickUpper})) — no action needed right now`
      : `Position #${tokenId} has drifted out of range (tick ${tick} outside [${tickLower}, ${tickUpper})) — the agent would remove and re-mint on its next real check`,
  };
}

// --- Grid Trading ---

export interface GridTrial {
  timestamp: string;
  poolTick: number;
  level: number;
  targetWbnbFraction: number;
  wouldAct: boolean;
  reasoning: string;
}

const GRID_CENTER_TICK = 190000;
const LEVEL_SPACING_TICKS = 500;
const N_LEVELS = 5;

export async function runGridTrial(): Promise<GridTrial> {
  const client = getBscTestnetClient();
  const pool = await client.readContract({
    address: PANCAKESWAP_V3_TESTNET.wbnbUsdtPool001Pct,
    abi: pancakeV3PoolAbi,
    functionName: "slot0",
  });
  const tick = pool[1];

  const rawLevel = (tick - GRID_CENTER_TICK) / LEVEL_SPACING_TICKS;
  const level = Math.max(-N_LEVELS, Math.min(N_LEVELS, rawLevel));
  const target = Math.max(0, Math.min(1, 0.5 - level / (2 * N_LEVELS)));

  return {
    timestamp: new Date().toISOString(),
    poolTick: tick,
    level,
    targetWbnbFraction: target,
    wouldAct: true, // exact action depends on current holdings vs. target — see the agent's own real evidence for its actual last trade
    reasoning: `At level ${level.toFixed(2)}, target allocation is ${(target * 100).toFixed(0)}% WBNB — the agent buys more as price falls through levels, sells into strength as it rises`,
  };
}
