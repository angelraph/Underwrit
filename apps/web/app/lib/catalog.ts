// Category metadata and the agent shape every page renders. Agent data
// itself always comes from Postgres (see realAgents.ts); nothing here is
// sample data.

export type Category = "REBALANCING" | "GRID" | "YIELD" | "HEALTH_FACTOR";

export const CATEGORY_LABELS: Record<Category, string> = {
  REBALANCING: "Rebalancing",
  GRID: "Grid Trading",
  YIELD: "Yield Optimisation",
  HEALTH_FACTOR: "Health Factor Monitoring",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  REBALANCING: "Manages LP ranges, resets positions automatically",
  GRID: "Places and manages automated grid orders",
  YIELD: "Routes liquidity to the highest available APR",
  HEALTH_FACTOR: "Protects lending positions from liquidation",
};

export interface AgentView {
  id: string;
  name: string;
  category: Category;
  network: "TESTNET" | "MAINNET";
  source: "OURS" | "THIRD_PARTY";
  confidenceScore: number;
  daysObserved: number;
  /** Real span since this agent's earliest logged EvidenceSnapshot, i.e. how
   * long it's actually been live and monitored, distinct from daysObserved,
   * which only spans real Actions and stays low for an agent that's
   * correctly done nothing because nothing needed doing. */
  daysMonitored?: number;
  capitalTested: number;
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  avgCost: number;
  avgReactionTimeSec: number;
  netYieldPct: number | null;
  worstDrawdownPct: number | null;
  risk: "Low" | "Moderate" | "High";
  permissions: string[];
  spendCapDaily: number;
  fitScore?: number;
  /** Real on-chain wallet address for OURS agents; null for third-party agents with no real hire target. */
  walletAddress: string | null;
}

export const CATEGORY_ORDER: Category[] = [
  "REBALANCING",
  "GRID",
  "YIELD",
  "HEALTH_FACTOR",
];

// Keyword hints per category, checked against a freeform objective so the
// Job Contract form can default its Category dropdown to something plausible
// instead of silently sitting on CATEGORY_ORDER[0] regardless of what was
// typed. This is a starting guess the user can always change, never a
// substitute for them confirming it, and it never touches ranking itself,
// computeJobFit still filters strictly on whatever category is actually
// selected when the form is submitted.
const CATEGORY_KEYWORDS: Record<Category, RegExp[]> = {
  HEALTH_FACTOR: [
    /liquidat/i,
    /health factor/i,
    /collateral/i,
    /\brepay/i,
    /undercollateral/i,
    /\bborrow/i,
    /\bloan\b/i,
    /lending position/i,
    /margin call/i,
    /\bltv\b/i,
    /loan.to.value/i,
    /at risk of (getting )?liquidated/i,
    /keep.*(loan|position).*safe/i,
    /safe from liquidation/i,
    /protect.*(position|collateral|loan)/i,
  ],
  GRID: [
    /\bgrid\b/i,
    /price ladder/i,
    /\bdca\b/i,
    /dollar.cost.averag/i,
    /ladder strategy/i,
    /buy low.*sell high/i,
    /range trading/i,
    /grid bot/i,
    /price level/i,
  ],
  YIELD: [
    /\byield\b/i,
    /\bapy\b/i,
    /\bapr\b/i,
    /supply rate/i,
    /\bfarm(ing)?\b/i,
    /interest rate/i,
    /passive income/i,
    /maximi[sz]e.*(return|yield|apy)/i,
    /best (return|rate|apy)/i,
    /grow my (capital|money|funds)/i,
    /earn (more|interest|yield)/i,
    /compound(ing)?/i,
    /put.*(capital|money|funds).*to work/i,
  ],
  REBALANCING: [
    /rebalanc/i,
    /liquidity position/i,
    /\blp\b/i,
    /concentrated liquidity/i,
    /price range/i,
    /impermanent loss/i,
    /tick range/i,
    /in.range|out.of.range/i,
    /manage my (lp|position|liquidity)/i,
    /v3 position/i,
  ],
};

/** Best-effort category guess from a freeform job objective, or undefined if
 * nothing matches strongly enough to guess. Picks whichever category has the
 * most keyword hits; ties go to the earlier category in CATEGORY_ORDER. */
export function guessCategoryFromObjective(objective: string): Category | undefined {
  if (!objective.trim()) return undefined;
  let best: Category | undefined;
  let bestCount = 0;
  for (const category of CATEGORY_ORDER) {
    const count = CATEGORY_KEYWORDS[category].filter((re) => re.test(objective)).length;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/**
 * What an agent's netYieldPct actually measures in each category, so the
 * same field is never shown under a label that means something else.
 * Health Factor has no such figure.
 */
export const RESULT_LABELS: Record<Category, string | null> = {
  YIELD: "Earned, annualized",
  GRID: "vs. just holding",
  REBALANCING: "vs. unmanaged range",
  HEALTH_FACTOR: null,
};

export function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Counterfactual amounts: BNB figures are small, so keep significant digits rather than two decimals. */
export function formatOutcome(value: number, unit: string, signed = false): string {
  const sign = signed && value >= 0 ? "+" : "";
  const n = unit === "BNB" ? value.toLocaleString("en-US", { maximumSignificantDigits: 3 }) : value.toFixed(2);
  return `${sign}${n} ${unit}`;
}

/** Capital tested and gas costs are recorded in (testnet) BNB, never USD. */
export function formatBnb(amount: number): string {
  return `${amount.toLocaleString("en-US", { maximumSignificantDigits: 2 })} BNB`;
}

export function protocolsFromPermissions(permissions: string[]): string[] {
  return Array.from(new Set(permissions.map((p) => p.split(":")[0].trim())));
}

