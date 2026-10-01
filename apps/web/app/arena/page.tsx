import Link from "next/link";
import { prisma } from "@underwrit/db";
import { CATEGORY_LABELS, CATEGORY_ORDER, formatOutcome, formatSignedPct, type Category } from "../lib/catalog";
import { getAllAgents } from "../lib/agents";

// Same reasoning as categories/page.tsx, read live, never bake in a
// build-time snapshot of the leaderboard.
export const dynamic = "force-dynamic";

// Every 6-hourly sync measures each agent against its category's
// do-nothing baseline: the agent's real holdings and the baseline both
// valued at the same block and pool price, written as an ArenaRun row (see
// packages/db/scripts/lib/arena.ts). This page ranks on the latest row and
// shows how many measurements stand behind it.
const ARENA_SCENARIO = "vs-do-nothing";

interface ArenaMetrics {
  baseline: string;
  baselineBnb: number;
  actualBnb: number;
  valueCreatedBnb: number;
  vsBaselinePct: number;
  block: string;
  /** Set when the row measures one strategy version from its own start, e.g. "v2". */
  window?: string;
}

type ArenaEntry = { latest: ArenaMetrics; latestAt: Date; count: number; firstAt: Date };

/** One entry per agent and measurement window (all-time, or a strategy version's own record). */
const entryKey = (agentId: string, window?: string) => `${agentId}:${window ?? "all"}`;

function since(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.max(1, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  return `${hours}h ago`;
}

export default async function ArenaPage() {
  const [allAgents, runs] = await Promise.all([
    getAllAgents(),
    prisma.arenaRun.findMany({ where: { scenarioId: ARENA_SCENARIO }, orderBy: { runAt: "desc" } }),
  ]);

  const byAgent = new Map<string, ArenaEntry>();
  for (const run of runs) {
    const metrics = run.metricsJson as unknown as ArenaMetrics;
    const key = entryKey(run.agentId, metrics.window);
    const entry = byAgent.get(key);
    if (!entry) {
      byAgent.set(key, { latest: metrics, latestAt: run.runAt, count: 1, firstAt: run.runAt });
    } else {
      entry.count++;
      entry.firstAt = run.runAt; // runs are newest first, so the last one seen is the earliest
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Agent Arena</h1>
      <p className="mt-2 text-muted max-w-2xl">
        Every agent is measured against the same do-nothing baseline for its category: what its starting capital
        would be worth today if the agent had never acted. Both sides are priced at the same block, from the
        agent&apos;s real on-chain holdings, and re-measured every six hours. Agents start with different capital
        on different days, so compare results as a percentage, not as raw amounts.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {CATEGORY_ORDER.map((category) => (
          <CategoryTable
            key={category}
            category={category}
            agents={allAgents.filter((a) => a.category === category)}
            byAgent={byAgent}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryTable({
  category,
  agents,
  byAgent,
}: {
  category: Category;
  agents: Awaited<ReturnType<typeof getAllAgents>>;
  byAgent: Map<string, ArenaEntry>;
}) {
  // Health Factor protection isn't a holdings-vs-baseline contest: its job
  // is to repay before liquidation, so it's compared on response time.
  if (category === "HEALTH_FACTOR") {
    return (
      <section>
        <h2 className="text-lg font-medium">{CATEGORY_LABELS[category]}</h2>
        <p className="mt-1 text-sm text-muted">
          Compared on how fast the agent gets a repayment confirmed once it sees a position at risk.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-left px-4 py-2">Detection to confirmed tx</th>
                <th className="text-left px-4 py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/agents/${agent.id}`} className="hover:text-accent transition-colors">
                      {agent.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 mono-nums text-accent">
                    {agent.avgReactionTimeSec > 0
                      ? `${agent.avgReactionTimeSec.toFixed(1)}s`
                      : "not yet timed (no position has been at risk since timing began)"}
                  </td>
                  <td className="px-4 py-3 mono-nums">{agent.confidenceScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // All-time rows are ranked against each other. A strategy version's own
  // record sits directly under its agent: it measures a different window
  // against a different starting point, so it isn't ranked with them.
  const ranked = agents
    .map((agent) => ({
      agent,
      arena: byAgent.get(entryKey(agent.id)),
      versions: [...byAgent.entries()]
        .filter(([key]) => key.startsWith(`${agent.id}:`) && key !== entryKey(agent.id))
        .map(([, v]) => v),
    }))
    .sort((a, b) => (b.arena?.latest.vsBaselinePct ?? -Infinity) - (a.arena?.latest.vsBaselinePct ?? -Infinity));
  const baselineText = ranked.find((r) => r.arena)?.arena?.latest.baseline;

  return (
    <section>
      <h2 className="text-lg font-medium">{CATEGORY_LABELS[category]}</h2>
      {baselineText && <p className="mt-1 text-sm text-muted">Baseline: {baselineText}.</p>}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Rank</th>
              <th className="text-left px-4 py-2">Agent</th>
              <th className="text-left px-4 py-2">vs. baseline</th>
              <th className="text-left px-4 py-2">Holdings now / baseline</th>
              <th className="text-left px-4 py-2">Measurements</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ agent, arena, versions }, i) => [
              <tr key={agent.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted">{arena ? i + 1 : "-"}</td>
                <td className="px-4 py-3">
                  <Link href={`/agents/${agent.id}`} className="hover:text-accent transition-colors">
                    {agent.name}
                  </Link>
                </td>
                {arena ? (
                  <>
                    <td className={`px-4 py-3 mono-nums ${arena.latest.vsBaselinePct < 0 ? "text-risk-high" : "text-accent"}`}>
                      {formatSignedPct(arena.latest.vsBaselinePct)}
                    </td>
                    <td className="px-4 py-3 mono-nums whitespace-nowrap">
                      {formatOutcome(arena.latest.actualBnb, "BNB")} / {formatOutcome(arena.latest.baselineBnb, "BNB")}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {arena.count === 1
                        ? `1 so far, ${since(arena.latestAt)}`
                        : `${arena.count}, first ${since(arena.firstAt)}, latest ${since(arena.latestAt)}`}{" "}
                      (block {arena.latest.block})
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-muted" colSpan={3}>
                    not measured yet
                  </td>
                )}
              </tr>,
              ...versions.map((v) => (
                <tr key={`${agent.id}-${v.latest.window}`} className="border-t border-border bg-surface-raised/40">
                  <td className="px-4 py-3 text-muted" />
                  <td className="px-4 py-3 text-muted">
                    {v.latest.window} only
                    <div className="text-xs">vs. {v.latest.baseline}</div>
                  </td>
                  <td className={`px-4 py-3 mono-nums ${v.latest.vsBaselinePct < 0 ? "text-risk-high" : "text-accent"}`}>
                    {formatSignedPct(v.latest.vsBaselinePct)}
                  </td>
                  <td className="px-4 py-3 mono-nums whitespace-nowrap">
                    {formatOutcome(v.latest.actualBnb, "BNB")} / {formatOutcome(v.latest.baselineBnb, "BNB")}
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {v.count === 1 ? `1 so far, ${since(v.latestAt)}` : `${v.count}, first ${since(v.firstAt)}, latest ${since(v.latestAt)}`}{" "}
                    (block {v.latest.block})
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}
