/**
 * "What would've happened if this agent hadn't acted?" — the counterfactual
 * is what turns a reputation score into a value claim a judge (or a user)
 * can check the arithmetic on.
 */
export interface CounterfactualInput {
  baselineScenario: string; // e.g. "held 50/50", "did nothing"
  baselineOutcome: number; // same unit as actualOutcome (e.g. % yield, or $ value)
  actualOutcome: number;
}

export interface CounterfactualResult extends CounterfactualInput {
  valueCreated: number;
}

export function computeCounterfactual(input: CounterfactualInput): CounterfactualResult {
  return {
    ...input,
    valueCreated: input.actualOutcome - input.baselineOutcome,
  };
}

/**
 * Standard baselines per category — keep these consistent across all agents
 * in a category so cross-agent comparison is fair.
 *
 * YIELD's baseline was originally "held in the single highest-TVL pool at
 * job start, no rebalancing" — a real, defensible comparison in principle,
 * but not one this project can honestly compute yet (it would need real
 * TVL data across multiple pools at the moment capital arrived, which
 * nothing here tracks). Changed to "held idle, uninvested" — the baseline
 * that's actually true to what the agent's real v1 scope does (route idle
 * capital into the best real rate) and that a real number can be computed
 * against without inventing a comparison this project can't back up.
 */
export const CATEGORY_BASELINES: Record<string, string> = {
  REBALANCING: "held initial LP range unmanaged",
  GRID: "held spot position, no grid orders",
  YIELD: "held idle, uninvested",
  HEALTH_FACTOR: "took no monitoring or repayment action",
};
