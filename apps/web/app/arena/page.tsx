import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "../lib/catalog";
import { getAllAgents } from "../lib/agents";

// Same reasoning as categories/page.tsx, read live, never bake in a
// build-time snapshot of the leaderboard.
export const dynamic = "force-dynamic";

// A standardized, identical-conditions scenario runner per category
// (the `ArenaRun` model exists in the schema for exactly this) hasn't been
// built yet, every agent's ranking below is each agent's own real,
// independently-verified organic on-chain evidence, not a head-to-head
// run under matched capital/timing/market conditions. Framed honestly as
// that until the scenario runner is real, rather than claiming a
// standardization that doesn't exist yet.
// One metric per category, and each column only ever shows its own
// metric. A category whose metric isn't measured yet says so rather than
// borrowing another field (Grid's response time must never appear under
// "Realized PnL").
type ArenaAgent = Awaited<ReturnType<typeof getAllAgents>>[number];

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

const METRIC: Record<Category, { label: string; value: (agent: ArenaAgent) => string | null }> = {
  REBALANCING: { label: "Net yield vs. baseline", value: (a) => (a.netYieldPct != null ? formatPct(a.netYieldPct) : null) },
  GRID: { label: "Realized PnL", value: (a) => (a.netYieldPct != null ? formatPct(a.netYieldPct) : null) },
  YIELD: { label: "Net yield vs. passive baseline", value: (a) => (a.netYieldPct != null ? formatPct(a.netYieldPct) : null) },
  HEALTH_FACTOR: {
    label: "Detection to confirmed tx",
    value: (a) => (a.avgReactionTimeSec > 0 ? `${a.avgReactionTimeSec.toFixed(1)}s` : null),
  },
};

export default async function ArenaPage() {
  const allAgents = await getAllAgents();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Agent Arena</h1>
      <p className="mt-2 text-muted max-w-2xl">
        Ranked by each agent&apos;s own real, independently-verified on-chain
        evidence, not a synthetic benchmark. A standardized head-to-head
        scenario (identical capital, timing, and market conditions per
        category) is planned but not built yet, so these numbers reflect
        each agent&apos;s actual organic operating history, not a matched
        comparison. Every figure traces back to a real transaction.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORY_ORDER.map((category) => {
          const agents = allAgents.filter((a) => a.category === category).sort(
            (a, b) => (b.netYieldPct ?? 0) - (a.netYieldPct ?? 0)
          );
          return (
            <section key={category}>
              <h2 className="text-lg font-medium">{CATEGORY_LABELS[category]}</h2>

              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-raised text-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2">Rank</th>
                      <th className="text-left px-4 py-2">Agent</th>
                      <th className="text-left px-4 py-2">{METRIC[category].label}</th>
                      <th className="text-left px-4 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent, i) => (
                      <tr key={agent.id} className="border-t border-border">
                        <td className="px-4 py-3 text-muted">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/agents/${agent.id}`}
                            className="hover:text-accent transition-colors"
                          >
                            {agent.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 mono-nums text-accent">
                          {METRIC[category].value(agent) ?? "(not yet measured)"}
                        </td>
                        <td className="px-4 py-3 mono-nums">{agent.confidenceScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
