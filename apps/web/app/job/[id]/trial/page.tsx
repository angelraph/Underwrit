import Link from "next/link";
import { notFound } from "next/navigation";
import type { Address } from "viem";
import { getAgentById } from "../../../lib/agents";
import {
  runHealthFactorTrial,
  runYieldTrial,
  runRebalancerTrial,
  runGridTrial,
} from "../../../lib/liveTrial";

async function getLiveTrial(category: string, walletAddress: string | null) {
  if (!walletAddress) return null;
  const addr = walletAddress as Address;
  try {
    switch (category) {
      case "HEALTH_FACTOR": {
        const r = await runHealthFactorTrial(addr);
        return {
          headline: r.tier,
          wouldAct: r.wouldAct,
          reasoning: r.reasoning,
          rows: [
            ["Spare liquidity", `${r.liquidityUsd} USD`],
            ["Shortfall", `${r.shortfallUsd} USD`],
          ],
        };
      }
      case "YIELD": {
        const r = await runYieldTrial(addr);
        return {
          headline: `${r.bestMarket} wins`,
          wouldAct: r.wouldAct,
          reasoning: r.reasoning,
          rows: [
            ["vBNB real supply APY", `${r.vBnbApyPct.toFixed(2)}%`],
            ["vUSDT real supply APY", `${r.vUsdtApyPct.toFixed(2)}%`],
          ],
        };
      }
      case "REBALANCING": {
        const r = await runRebalancerTrial(addr);
        return {
          headline: r.position ? (r.inRange ? "In range" : "Out of range") : "No position",
          wouldAct: r.wouldAct,
          reasoning: r.reasoning,
          rows: [
            ["Current pool tick", String(r.poolTick)],
            ...(r.position ? [["Position range", `[${r.position.tickLower}, ${r.position.tickUpper})`]] : []),
          ],
        };
      }
      case "GRID": {
        const r = await runGridTrial();
        return {
          headline: `${(r.targetWbnbFraction * 100).toFixed(0)}% WBNB target`,
          wouldAct: r.wouldAct,
          reasoning: r.reasoning,
          rows: [
            ["Current pool tick", String(r.poolTick)],
            ["Grid level", r.level.toFixed(2)],
          ],
        };
      }
      default:
        return null;
    }
  } catch {
    return null; // RPC hiccup — fall back to historical-only view rather than crash the page
  }
}

export default async function TrialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { id } = await params;
  const { agent: agentId } = await searchParams;
  const agent = agentId ? await getAgentById(agentId) : undefined;
  if (!agent) notFound();

  const live = await getLiveTrial(agent.category, agent.walletAddress);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <div className="text-sm text-muted">Trial</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        {agent.name}
      </h1>
      <p className="mt-2 text-muted">
        {live
          ? "A real, gas-free dry run of this agent's actual decision logic against live chain state, not a replay of old numbers. Nothing here signs or spends."
          : "This agent has no live wallet to dry-run yet. Showing its historical track record instead."}
      </p>

      {live && (
        <div className="mt-8 rounded-lg border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-muted">Live decision, right now</div>
            <span
              className={`text-xs rounded-full border px-2 py-0.5 ${
                live.wouldAct ? "border-accent/40 text-accent bg-accent/10" : "border-border text-muted"
              }`}
            >
              {live.wouldAct ? "Would act" : "Would hold"}
            </span>
          </div>
          <div className="mt-2 text-lg font-medium">{live.headline}</div>
          <p className="mt-1 text-sm text-muted">{live.reasoning}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm border-t border-border/60 pt-4">
            {live.rows.map(([label, value]) => (
              <div key={label}>
                <div className="text-muted text-xs">{label}</div>
                <div className="mono-nums">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <div className="text-sm font-medium">
          Track record: {agent.daysObserved} days of observed activity
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted text-xs">Net yield to date</div>
            <div className="mono-nums text-lg text-accent">
              {agent.netYieldPct != null ? `+${agent.netYieldPct.toFixed(1)}%` : "n/a for this category"}
            </div>
          </div>
          <div>
            <div className="text-muted text-xs">Worst drawdown observed</div>
            <div className="mono-nums text-lg">
              {agent.worstDrawdownPct != null ? `-${agent.worstDrawdownPct.toFixed(1)}%` : "not yet measured"}
            </div>
          </div>
          <div>
            <div className="text-muted text-xs">Est. actions over 14 days</div>
            <div className="mono-nums text-lg">
              {agent.daysObserved > 0
                ? Math.round((agent.actionsExecuted / agent.daysObserved) * 14)
                : "not yet measured"}
            </div>
          </div>
          <div>
            <div className="text-muted text-xs">Est. total cost</div>
            <div className="mono-nums text-lg">
              {agent.daysObserved > 0
                ? `$${(agent.avgCost * Math.round((agent.actionsExecuted / agent.daysObserved) * 14)).toFixed(2)}`
                : "not yet measured"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
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
