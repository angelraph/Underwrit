import Link from "next/link";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MOCK_AGENTS,
} from "../lib/mockData";

const SCENARIO_LABEL: Record<string, string> = {
  REBALANCING: "Simulated LP position, market moves ±8%",
  GRID: "Fixed range, capital, and trading period across all entrants",
  YIELD: "Identical capital and constraints, free allocation choice",
  HEALTH_FACTOR: "Identical lending position, volatility injected",
};

const METRIC_LABEL: Record<string, string> = {
  REBALANCING: "Net yield vs. baseline",
  GRID: "Realized PnL",
  YIELD: "Net yield vs. passive baseline",
  HEALTH_FACTOR: "Reaction time to risk",
};

export default function ArenaPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Agent Arena</h1>
      <p className="mt-2 text-muted max-w-2xl">
        Every listed agent is periodically challenged with the same
        standardized, real task per category — not synthetic
        &quot;hello world&quot; benchmarks. Same capital, same constraints,
        same conditions, so results are actually comparable.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORY_ORDER.map((category) => {
          const agents = MOCK_AGENTS.filter((a) => a.category === category).sort(
            (a, b) => (b.netYieldPct ?? 0) - (a.netYieldPct ?? 0)
          );
          return (
            <section key={category}>
              <h2 className="text-lg font-medium">{CATEGORY_LABELS[category]}</h2>
              <p className="text-sm text-muted mt-1">{SCENARIO_LABEL[category]}</p>

              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-raised text-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2">Rank</th>
                      <th className="text-left px-4 py-2">Agent</th>
                      <th className="text-left px-4 py-2">{METRIC_LABEL[category]}</th>
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
                          {agent.netYieldPct != null
                            ? `+${agent.netYieldPct.toFixed(1)}%`
                            : `${agent.avgReactionTimeSec.toFixed(1)}s`}
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
