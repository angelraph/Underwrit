import Link from "next/link";
import type { MockAgent } from "../lib/mockData";
import { RiskBadge } from "./RiskBadge";

/**
 * The Agent Performance Passport — evidence, not a profile. Every stat here
 * is meant to trace back to a real Action row once wired to @underwrit/db;
 * this component only formats, it never invents numbers.
 */
export function PassportCard({ agent, showHire = true }: { agent: MockAgent; showHire?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/agents/${agent.id}`}
            className="font-medium hover:text-accent transition-colors"
          >
            {agent.name}
          </Link>
          <div className="text-xs text-muted mt-0.5">
            {agent.network === "MAINNET" ? "Mainnet" : "Testnet"} ·{" "}
            {agent.source === "OURS" ? "Reference agent" : "Third-party (8004scan)"}
            {agent.daysMonitored != null && agent.daysMonitored > agent.daysObserved
              ? ` · live ${agent.daysMonitored}d`
              : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="mono-nums text-2xl font-semibold text-accent">
            {agent.confidenceScore}
          </div>
          <div className="text-[10px] text-muted uppercase tracking-wide">
            confidence
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Stat label="Observed over" value={`${agent.daysObserved} days`} />
        <Stat label="Capital tested" value={`$${agent.capitalTested.toLocaleString()}`} />
        <Stat
          label="Actions"
          value={`${agent.actionsSucceeded}/${agent.actionsExecuted} succeeded`}
        />
        <Stat label="Avg cost" value={`$${agent.avgCost.toFixed(3)}`} />
        <Stat
          label="Avg reaction"
          value={agent.avgReactionTimeSec > 0 ? `${agent.avgReactionTimeSec.toFixed(1)}s` : "not yet measured"}
        />
        {agent.netYieldPct != null && (
          <Stat label="Net yield" value={`+${agent.netYieldPct.toFixed(1)}%`} />
        )}
        {agent.worstDrawdownPct != null && (
          <Stat label="Worst drawdown" value={`-${agent.worstDrawdownPct.toFixed(1)}%`} />
        )}
      </dl>

      <div className="flex items-center justify-between">
        <RiskBadge risk={agent.risk} />
        {agent.fitScore != null && (
          <span className="text-xs text-muted">
            Job Fit <span className="mono-nums text-foreground">{agent.fitScore}</span>
          </span>
        )}
      </div>

      <div className="border-t border-border pt-3 text-xs text-muted">
        <span className="font-medium text-foreground">Permissions requested:</span>{" "}
        {agent.permissions.join(" · ")} · ${agent.spendCapDaily}/day cap
      </div>

      {showHire && (
        <div className="flex gap-2 pt-1">
          <Link
            href={`/agents/${agent.id}`}
            className="flex-1 text-center rounded-md border border-border px-3 py-2 text-sm hover:border-accent/50 transition-colors"
          >
            View Passport
          </Link>
          <Link
            href={`/job/new?category=${agent.category}&agent=${agent.id}`}
            className="flex-1 text-center rounded-md bg-accent-dim text-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Hire
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mono-nums">{value}</dd>
    </div>
  );
}
