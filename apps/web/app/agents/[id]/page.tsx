import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@underwrit/db";
import { CATEGORY_LABELS } from "../../lib/mockData";
import { getAgentById } from "../../lib/agents";
import { RiskBadge } from "../../components/RiskBadge";

export default async function AgentPassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgentById(id);
  if (!agent) notFound();

  // Real counterfactual, if this is a DB-backed agent with one recorded
  // (see packages/db/scripts/syncHealthFactorGuardian.ts). Mock agents (and
  // real agents with no counterfactual yet) fall through to null and the
  // section below shows an honest "not yet available" state instead of a
  // fabricated number.
  let counterfactual: {
    baselineScenario: string;
    baselineOutcome: number;
    actualOutcome: number;
    valueCreated: number;
    unit: string;
  } | null = null;
  try {
    counterfactual = await prisma.counterfactual.findFirst({
      where: { action: { agentId: agent.id } },
      orderBy: { id: "desc" },
    });
  } catch {
    // DB unreachable — leave counterfactual null, page still renders.
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="text-sm text-muted">
        {CATEGORY_LABELS[agent.category]} ·{" "}
        {agent.network === "MAINNET" ? "Mainnet" : "Testnet"}
        {agent.daysMonitored != null && agent.daysMonitored > agent.daysObserved
          ? ` · live and monitored for ${agent.daysMonitored} days`
          : ""}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
        <RiskBadge risk={agent.risk} />
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <BigStat label="Confidence" value={String(agent.confidenceScore)} accent />
        <BigStat label="Observed over" value={`${agent.daysObserved}d`} />
        <BigStat
          label="Success rate"
          value={`${Math.round((agent.actionsSucceeded / agent.actionsExecuted) * 100)}%`}
        />
        <BigStat label="Capital tested" value={`$${agent.capitalTested.toLocaleString()}`} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
          Evidence
        </h2>
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm border-t border-border pt-4">
          <Stat label="Actions executed" value={String(agent.actionsExecuted)} />
          <Stat label="Successful" value={String(agent.actionsSucceeded)} />
          <Stat label="Failed" value={String(agent.actionsFailed)} />
          <Stat label="Average execution cost" value={`$${agent.avgCost.toFixed(3)}`} />
          <Stat
            label="Average reaction time"
            value={agent.avgReactionTimeSec > 0 ? `${agent.avgReactionTimeSec.toFixed(1)}s` : "not yet measured"}
          />
          {agent.netYieldPct != null && (
            <Stat label="Net yield improvement" value={`+${agent.netYieldPct.toFixed(1)}%`} />
          )}
          {agent.worstDrawdownPct != null && (
            <Stat label="Worst drawdown" value={`-${agent.worstDrawdownPct.toFixed(1)}%`} />
          )}
        </dl>
      </section>

      <section className="mt-10 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
          Counterfactual: what would&apos;ve happened without this agent
        </h2>
        {counterfactual ? (
          <>
            <p className="mt-3 text-sm text-muted">
              Most recent real action, compared against: &quot;
              {counterfactual.baselineScenario}&quot;.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted text-xs">Actual result</div>
                <div className="mono-nums text-lg">
                  {counterfactual.actualOutcome.toFixed(2)} {counterfactual.unit}
                </div>
              </div>
              <div>
                <div className="text-muted text-xs">Baseline (no action)</div>
                <div className="mono-nums text-lg">
                  {counterfactual.baselineOutcome.toFixed(2)} {counterfactual.unit}
                </div>
              </div>
              <div>
                <div className="text-muted text-xs">Value created</div>
                <div className="mono-nums text-lg text-accent">
                  +{counterfactual.valueCreated.toFixed(2)} {counterfactual.unit}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No counterfactual recorded yet. This agent hasn&apos;t taken a
            protective action with a measured baseline comparison.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
          Permissions requested
        </h2>
        <ul className="mt-3 text-sm space-y-1">
          {agent.permissions.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="text-risk-low">✓</span> {p}
            </li>
          ))}
          <li className="flex items-center gap-2 text-muted">
            <span className="text-risk-high">✕</span> Withdrawals
          </li>
        </ul>
        <div className="mt-2 text-sm text-muted">
          ${agent.spendCapDaily}/day proposed spend cap · expiry set by you
          at hire time · enforced on-chain via Altana, revocable anytime
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/job/new?category=${agent.category}&agent=${agent.id}`}
          className="rounded-md border border-border px-4 py-2.5 text-sm hover:border-accent/50 transition-colors"
        >
          Run Simulation
        </Link>
        <Link
          href={`/job/new?category=${agent.category}&agent=${agent.id}`}
          className="rounded-md bg-accent-dim text-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          Hire Agent
        </Link>
      </div>
    </div>
  );
}

function BigStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className={`mono-nums text-2xl font-semibold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
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
