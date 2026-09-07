// Placeholder data so every screen renders meaningfully before the DB is
// wired up (week 1 goal per the build plan) and before the four reference
// agents have real logged actions. Swap for Prisma queries against
// @underwrit/db once the agents are deployed and running on testnet — every
// field here is shaped exactly like the real EvidenceSnapshot/Action schema
// so that swap is a data-source change, not a UI rewrite.

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

export interface MockAgent {
  id: string;
  name: string;
  category: Category;
  network: "TESTNET" | "MAINNET";
  source: "OURS" | "THIRD_PARTY";
  confidenceScore: number;
  daysObserved: number;
  /** Real span since this agent's earliest logged EvidenceSnapshot, i.e. how
   * long it's actually been live and monitored — distinct from daysObserved,
   * which only spans real Actions and stays low for an agent that's
   * correctly done nothing because nothing needed doing. Undefined for mock
   * agents, which have no snapshot history to derive it from. */
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
  /** Real on-chain wallet address for OURS agents; null for mock/third-party agents with no real hire target. */
  walletAddress: string | null;
}

export const MOCK_AGENTS: MockAgent[] = [
  {
    id: "hf-guardian-01",
    name: "Health Factor Guardian",
    category: "HEALTH_FACTOR",
    network: "TESTNET",
    source: "OURS",
    confidenceScore: 87,
    daysObserved: 31,
    capitalTested: 18420,
    actionsExecuted: 147,
    actionsSucceeded: 139,
    actionsFailed: 8,
    avgCost: 0.021,
    avgReactionTimeSec: 18.4,
    netYieldPct: null,
    worstDrawdownPct: 2.8,
    risk: "Moderate",
    permissions: ["Venus: repay", "Venus: read position"],
    spendCapDaily: 250,
    walletAddress: null,
  },
  {
    id: "lp-optimizer-1847",
    name: "LP Optimizer #1847",
    category: "REBALANCING",
    network: "TESTNET",
    source: "OURS",
    confidenceScore: 82,
    daysObserved: 24,
    capitalTested: 12000,
    actionsExecuted: 96,
    actionsSucceeded: 91,
    actionsFailed: 5,
    avgCost: 0.034,
    avgReactionTimeSec: 22.1,
    netYieldPct: 3.2,
    worstDrawdownPct: 2.1,
    risk: "Moderate",
    permissions: ["PancakeSwap: liquidity", "PancakeSwap: swap"],
    spendCapDaily: 500,
    walletAddress: null,
  },
  {
    id: "grid-runner-04",
    name: "Grid Runner #4",
    category: "GRID",
    network: "TESTNET",
    source: "OURS",
    confidenceScore: 74,
    daysObserved: 18,
    capitalTested: 6400,
    actionsExecuted: 212,
    actionsSucceeded: 198,
    actionsFailed: 14,
    avgCost: 0.012,
    avgReactionTimeSec: 4.7,
    netYieldPct: 5.1,
    worstDrawdownPct: 4.6,
    risk: "Moderate",
    permissions: ["PancakeSwap: swap"],
    spendCapDaily: 300,
    walletAddress: null,
  },
  {
    id: "yield-router-02",
    name: "Yield Router #2",
    category: "YIELD",
    network: "TESTNET",
    source: "OURS",
    confidenceScore: 79,
    daysObserved: 22,
    capitalTested: 9800,
    actionsExecuted: 61,
    actionsSucceeded: 59,
    actionsFailed: 2,
    avgCost: 0.019,
    avgReactionTimeSec: 31.0,
    netYieldPct: 4.4,
    worstDrawdownPct: 1.2,
    risk: "Low",
    permissions: ["Venus: lend", "Lista: stake", "PancakeSwap: liquidity"],
    spendCapDaily: 400,
    walletAddress: null,
  },
];

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
// substitute for them confirming it, and it never touches ranking itself —
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

export function protocolsFromPermissions(permissions: string[]): string[] {
  return Array.from(new Set(permissions.map((p) => p.split(":")[0].trim())));
}

