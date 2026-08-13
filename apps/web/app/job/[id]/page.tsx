import Link from "next/link";
import type { AgentCandidate, JobConstraints } from "@underwrit/evidence-engine";
import { rankAgentsForJob } from "@underwrit/evidence-engine";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MOCK_AGENTS,
  protocolsFromPermissions,
  type Category,
} from "../../lib/mockData";
import { RiskBadge } from "../../components/RiskBadge";

// This job id is a placeholder until /job/new posts to a real API route that
// persists a JobSpec via @underwrit/db (week 2). The Job Fit computation
// below is already real — swap MOCK_AGENTS for a Prisma query and nothing
// else here needs to change.
export default async function JobResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: rawCategory } = await searchParams;
  const category: Category =
    (CATEGORY_ORDER.find((c) => c === rawCategory) as Category) ?? "REBALANCING";

  const constraints: JobConstraints = {
    maxCapital: 5000,
    maxDailySpend: 20,
    maxDrawdownPct: 3,
    allowedProtocols: [],
    withdrawalsAllowed: false,
    expiryDays: 14,
  };

  const candidates: AgentCandidate[] = MOCK_AGENTS.map((a) => ({
    agentId: a.id,
    category: a.category,
    network: a.network,
    protocolsUsed: protocolsFromPermissions(a.permissions),
    avgCostPerAction: a.avgCost,
    netYieldPct: a.netYieldPct,
    worstDrawdownPct: a.worstDrawdownPct,
    evidence: {
      confidenceScore: a.confidenceScore,
      successRate: a.actionsSucceeded / a.actionsExecuted,
      avgCost: a.avgCost,
      avgReactionTimeSec: a.avgReactionTimeSec,
      capitalTested: a.capitalTested,
      daysObserved: a.daysObserved,
      actionsExecuted: a.actionsExecuted,
      actionsSucceeded: a.actionsSucceeded,
      actionsFailed: a.actionsFailed,
    },
  }));

  const results = rankAgentsForJob(candidates, constraints, category).filter(
    (r) => r.eligible
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="text-sm text-muted">{CATEGORY_LABELS[category]}</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        Job Fit results
      </h1>
      <p className="mt-2 text-muted max-w-xl">
        Job Fit = capability × evidence confidence × reliability × risk
        compatibility × price efficiency. Shown transparently, not a
        black-box recommendation.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {results.map((r, i) => {
          const agent = MOCK_AGENTS.find((a) => a.id === r.agentId)!;
          return (
            <div
              key={r.agentId}
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-muted text-sm w-5">{i + 1}.</span>
                  <div>
                    <Link
                      href={`/agents/${agent.id}`}
                      className="font-medium hover:text-accent transition-colors"
                    >
                      {agent.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {agent.network === "MAINNET" ? "Mainnet" : "Testnet"} ·{" "}
                      confidence {agent.confidenceScore}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <RiskBadge risk={agent.risk} />
                  <div className="text-right">
                    <div className="mono-nums text-xl font-semibold text-accent">
                      {r.fitScore}
                    </div>
                    <div className="text-[10px] text-muted uppercase tracking-wide">
                      job fit
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
                <ScoreBar label="Capability" value={r.breakdown.capabilityMatch} />
                <ScoreBar label="Evidence" value={r.breakdown.evidenceConfidence} />
                <ScoreBar label="Reliability" value={r.breakdown.reliability} />
                <ScoreBar label="Risk fit" value={r.breakdown.riskCompatibility} />
                <ScoreBar label="Price" value={r.breakdown.priceEfficiency} />
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/job/demo/trial?agent=${agent.id}`}
                  className="flex-1 text-center rounded-md border border-border px-3 py-2 text-sm hover:border-accent/50 transition-colors"
                >
                  Run Trial
                </Link>
                <Link
                  href={`/job/demo/hire?agent=${agent.id}`}
                  className="flex-1 text-center rounded-md bg-accent-dim text-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Hire
                </Link>
              </div>
            </div>
          );
        })}
        {results.length === 0 && (
          <p className="text-muted text-sm">
            No eligible agents found for these constraints yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
        <div
          className="h-full bg-accent-dim"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <div className="mt-1 text-muted">{label}</div>
    </div>
  );
}
