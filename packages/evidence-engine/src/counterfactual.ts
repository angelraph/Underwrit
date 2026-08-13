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

/** Standard baselines per category — keep these consistent across all agents in a category so cross-agent comparison is fair. */
export const CATEGORY_BASELINES: Record<string, string> = {
  REBALANCING: "held initial LP range unmanaged",
  GRID: "held spot position, no grid orders",
  YIELD: "held in the single highest-TVL pool at job start, no rebalancing",
  HEALTH_FACTOR: "took no monitoring or repayment action",
};
