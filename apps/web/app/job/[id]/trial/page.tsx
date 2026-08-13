import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_AGENTS } from "../../../lib/mockData";

export default async function TrialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { id } = await params;
  const { agent: agentId } = await searchParams;
  const agent = MOCK_AGENTS.find((a) => a.id === agentId);
  if (!agent) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="text-sm text-muted">Trial</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        {agent.name}
      </h1>
      <p className="mt-2 text-muted">
        Replays this job&apos;s constraints against the agent&apos;s real
        historical actions before any capital moves.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <div className="text-sm font-medium">
          Simulated over the last {agent.daysObserved} days of observed
          activity
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted text-xs">Projected outcome</div>
            <div className="mono-nums text-lg text-accent">
              +{(agent.netYieldPct ?? 3.6).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted text-xs">Projected worst case</div>
            <div className="mono-nums text-lg">
              -{(agent.worstDrawdownPct ?? 2.5).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted text-xs">Est. actions over 14 days</div>
            <div className="mono-nums text-lg">
              {Math.round((agent.actionsExecuted / agent.daysObserved) * 14)}
            </div>
          </div>
          <div>
            <div className="text-muted text-xs">Est. total cost</div>
            <div className="mono-nums text-lg">
              $
              {(
                agent.avgCost *
                Math.round((agent.actionsExecuted / agent.daysObserved) * 14)
              ).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href={`/agents/${agent.id}`}
          className="rounded-md border border-border px-4 py-2.5 text-sm hover:border-accent/50 transition-colors"
        >
          Back to Passport
        </Link>
        <Link
          href={`/job/${id}/hire?agent=${agent.id}`}
          className="rounded-md bg-accent-dim text-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          Proceed to Hire
        </Link>
      </div>
    </div>
  );
}
