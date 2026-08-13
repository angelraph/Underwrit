import type { ActionLike, EvidenceSnapshotFields } from "./types";

/**
 * Turns a raw Action log into the numbers shown on an Agent Performance
 * Passport. Every input here must come from real Action rows (real tx
 * hashes) — this function only aggregates, it never invents data.
 *
 * Confidence score combines three things, each capped so no single one can
 * dominate: how often the agent succeeds, how large the sample is (a 3-action
 * track record should not out-rank a 150-action one), and how long it's been
 * observed. Mainnet evidence carries more weight than testnet — same agent,
 * same actions, but real capital at stake is stronger proof (this is also
 * what the Altana track explicitly rewards).
 */
export function computeEvidenceSnapshot(
  actions: ActionLike[],
  opts: { network?: "TESTNET" | "MAINNET" } = {}
): EvidenceSnapshotFields {
  const actionsExecuted = actions.length;
  const succeeded = actions.filter((a) => a.result === "SUCCESS");
  const failed = actions.filter((a) => a.result === "FAIL");
  const successRate = actionsExecuted > 0 ? succeeded.length / actionsExecuted : 0;

  const costs = actions.map((a) => a.gasCost).filter((c): c is number => c != null);
  const avgCost = costs.length > 0 ? costs.reduce((s, c) => s + c, 0) / costs.length : 0;

  const latencies = actions.map((a) => a.latencyMs).filter((l): l is number => l != null);
  const avgReactionTimeSec =
    latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length / 1000 : 0;

  const capitalTested = actions.reduce((sum, a) => {
    const capital = a.paramsJson?.capital;
    return sum + (typeof capital === "number" ? capital : 0);
  }, 0);

  const timestamps = actions.map((a) => a.timestamp.getTime());
  const daysObserved =
    timestamps.length > 0
      ? Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000))
      : 0;

  const sampleFactor = Math.min(1, actionsExecuted / 100); // saturates at 100 actions
  const daysFactor = Math.min(1, daysObserved / 30); // saturates at 30 days
  const networkMultiplier = opts.network === "MAINNET" ? 1 : 0.85; // mainnet evidence weighted higher

  const rawConfidence = successRate * 100 * (0.5 + 0.25 * sampleFactor + 0.25 * daysFactor);
  const confidenceScore = Math.min(100, Math.round(rawConfidence * networkMultiplier));

  return {
    confidenceScore,
    successRate,
    avgCost,
    avgReactionTimeSec,
    capitalTested,
    daysObserved,
    actionsExecuted,
    actionsSucceeded: succeeded.length,
    actionsFailed: failed.length,
  };
}
