import { prisma } from "@underwrit/db";
import type { MockAgent } from "./mockData";

/**
 * Bridges real Prisma-backed agents into the same shape the UI already
 * renders (`MockAgent`) so PassportCard etc. don't need two code paths.
 * As each reference agent goes from mock to real, its category simply stops
 * appearing in the mock fallback set (see getAllAgents in agents.ts).
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
  YIELD: ["Venus: lend", "Lista: stake", "PancakeSwap: liquidity"],
};

export async function getRealAgentsAsMockShape(): Promise<MockAgent[]> {
  const agents = await prisma.agent.findMany({
    include: {
      evidenceSnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  return agents
    .filter((a) => a.evidenceSnapshots.length > 0)
    .map((a) => {
      const snap = a.evidenceSnapshots[0];
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        network: a.network,
        source: a.source,
        confidenceScore: snap.confidenceScore,
        daysObserved: snap.daysObserved,
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
        spendCapDaily: 250, // default proposed cap shown before a session is granted — the real enforced cap lives in the Session row once hired
        walletAddress: a.walletAddress,
      } satisfies MockAgent;
    });
}
