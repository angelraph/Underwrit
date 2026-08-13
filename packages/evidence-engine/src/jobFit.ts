import type { AgentCandidate, JobConstraints, JobFitResult } from "./types";

const WEIGHTS = {
  capabilityMatch: 0.25,
  evidenceConfidence: 0.2,
  reliability: 0.2,
  riskCompatibility: 0.2,
  priceEfficiency: 0.15,
};

/**
 * Job Fit = capability x evidence x reliability x risk-compatibility x price
 * efficiency, per the pitch. Implemented as a weighted average of five 0-100
 * subscores rather than a literal product: a pure product lets one weak
 * factor (e.g. a slightly-below-average price) crush an otherwise excellent
 * agent to near zero, which is hard to explain on a "shown transparently"
 * results screen. Weighted average keeps the same intent — no single factor
 * dominates, every factor matters — while staying legible as a breakdown bar
 * chart per candidate.
 *
 * Hard constraint violations (wrong category, drawdown over budget, protocol
 * outside the allowlist) make an agent ineligible entirely rather than just
 * lowering its score — a marketplace that ranks a disqualified agent #1 with
 * a caveat is not trustworthy.
 */
export function computeJobFit(
  candidate: AgentCandidate,
  constraints: JobConstraints,
  category: string,
  peerCostRange: { min: number; max: number }
): JobFitResult {
  if (candidate.category !== category) {
    return ineligible(candidate.agentId, "category mismatch");
  }

  if (
    candidate.worstDrawdownPct != null &&
    candidate.worstDrawdownPct > constraints.maxDrawdownPct
  ) {
    return ineligible(
      candidate.agentId,
      `worst observed drawdown ${candidate.worstDrawdownPct}% exceeds the ${constraints.maxDrawdownPct}% limit`
    );
  }

  if (constraints.allowedProtocols.length > 0) {
    const outsideAllowlist = candidate.protocolsUsed.filter(
      (p) => !constraints.allowedProtocols.includes(p)
    );
    if (outsideAllowlist.length > 0) {
      return ineligible(
        candidate.agentId,
        `uses protocol(s) not in the allowlist: ${outsideAllowlist.join(", ")}`
      );
    }
  }

  const capabilityMatch = 100; // category already matched above; refine with skill-tag overlap later
  const evidenceConfidence = candidate.evidence.confidenceScore;
  const reliability = candidate.evidence.successRate * 100;

  const riskCompatibility =
    candidate.worstDrawdownPct != null && constraints.maxDrawdownPct > 0
      ? 100 * (1 - (candidate.worstDrawdownPct / constraints.maxDrawdownPct) * 0.5)
      : 75; // no drawdown data yet — neutral-leaning score, not a free pass

  const { min, max } = peerCostRange;
  const priceEfficiency =
    max > min ? 100 * (1 - (candidate.avgCostPerAction - min) / (max - min)) : 100;

  const breakdown = {
    capabilityMatch,
    evidenceConfidence,
    reliability,
    riskCompatibility,
    priceEfficiency,
  };

  const fitScore = Math.round(
    breakdown.capabilityMatch * WEIGHTS.capabilityMatch +
      breakdown.evidenceConfidence * WEIGHTS.evidenceConfidence +
      breakdown.reliability * WEIGHTS.reliability +
      breakdown.riskCompatibility * WEIGHTS.riskCompatibility +
      breakdown.priceEfficiency * WEIGHTS.priceEfficiency
  );

  return {
    agentId: candidate.agentId,
    fitScore,
    breakdown,
    eligible: true,
  };
}

export function rankAgentsForJob(
  candidates: AgentCandidate[],
  constraints: JobConstraints,
  category: string
): JobFitResult[] {
  const eligiblePool = candidates.filter((c) => c.category === category);
  const costs = eligiblePool.map((c) => c.avgCostPerAction);
  const peerCostRange = { min: Math.min(...costs, 0), max: Math.max(...costs, 0) };

  return candidates
    .map((c) => computeJobFit(c, constraints, category, peerCostRange))
    .sort((a, b) => (b.eligible ? b.fitScore : -1) - (a.eligible ? a.fitScore : -1));
}

function ineligible(agentId: string, reason: string): JobFitResult {
  return {
    agentId,
    fitScore: 0,
    breakdown: {
      capabilityMatch: 0,
      evidenceConfidence: 0,
      reliability: 0,
      riskCompatibility: 0,
      priceEfficiency: 0,
    },
    eligible: false,
    ineligibleReason: reason,
  };
}
