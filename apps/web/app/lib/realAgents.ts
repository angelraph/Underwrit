import { prisma } from "@underwrit/db";
import type { AgentView } from "./catalog";

/**
 * Maps each Prisma agent and its latest EvidenceSnapshot into the shape
 * every page renders (`AgentView`).
 */

function deriveRisk(confidenceScore: number): "Low" | "Moderate" | "High" {
  if (confidenceScore >= 70) return "Low";
  if (confidenceScore >= 40) return "Moderate";
  return "High";
}

const CATEGORY_PERMISSIONS: Record<string, string[]> = {
  HEALTH_FACTOR: ["Venus: repay", "Venus: read position"],
  REBALANCING: ["PancakeSwap: liquidity", "PancakeSwap: swap"],
  GRID: ["PancakeSwap: swap"],
  // Venus supply only. Lista was dropped (no BSC Testnet deployment) and the
  // Yield Router never touches PancakeSwap, so neither is requested here.
  YIELD: ["Venus: lend"],
};

export async function getRealAgents(): Promise<AgentView[]> {
  const [agents, firstSnapshots] = await Promise.all([
    prisma.agent.findMany({
      include: {
        evidenceSnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
      },
    }),
    // Earliest snapshot per agent, real proof of how long it's actually
    // been live and monitored, not just when it last took a real action.
    prisma.evidenceSnapshot.groupBy({ by: ["agentId"], _min: { computedAt: true } }),
  ]);
  const firstSeenByAgentId = new Map(
    firstSnapshots.map((s) => [s.agentId, s._min.computedAt] as const)
  );

  return agents
    .filter((a) => a.evidenceSnapshots.length > 0)
    .map((a) => {
      const snap = a.evidenceSnapshots[0];
      const firstSeen = firstSeenByAgentId.get(a.id);
      const daysMonitored = firstSeen
        ? Math.max(1, Math.ceil((Date.now() - firstSeen.getTime()) / 86_400_000))
        : undefined;
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        network: a.network,
        source: a.source,
        confidenceScore: snap.confidenceScore,
        daysObserved: snap.daysObserved,
        daysMonitored,
        capitalTested: snap.capitalTested,
        actionsExecuted: snap.actionsExecuted,
        actionsSucceeded: snap.actionsSucceeded,
        actionsFailed: snap.actionsFailed,
        avgCost: snap.avgCost,
        avgReactionTimeSec: snap.avgReactionTimeSec,
        netYieldPct: snap.netYieldPct,
        worstDrawdownPct: snap.worstDrawdownPct,
        risk: deriveRisk(snap.confidenceScore),
        permissions: CATEGORY_PERMISSIONS[a.category] ?? [],
        spendCapDaily: 250, // default proposed cap shown before a session is granted, the real enforced cap lives in the Session row once hired
        walletAddress: a.walletAddress,
      } satisfies AgentView;
    });
}
