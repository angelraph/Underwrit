import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@underwrit/db";
import { CATEGORY_LABELS, formatBnb, formatOutcome, formatSignedPct, RESULT_LABELS } from "../../lib/catalog";
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
  // (see packages/db/scripts/syncHealthFactorGuardian.ts). Agents with no
  // counterfactual yet fall through to null and the section below shows an
  // honest "not yet available" state instead of a fabricated number.
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
    // DB unreachable, leave counterfactual null, page still renders.
  }

  // A strategy version's own record (e.g. the Rebalancer's v2), measured
  // from that version's start rather than the agent's whole history.
  const recentRuns = await prisma.arenaRun.findMany({ where: { agentId: agent.id }, orderBy: { runAt: "desc" }, take: 20 });
  const versionRun = recentRuns.find((r) => (r.metricsJson as Record<string, unknown>)?.window);
  const version = versionRun
    ? (versionRun.metricsJson as { window: string; baseline: string; baselineBnb: number; actualBnb: number; vsBaselinePct: number })
    : null;
  const versionStart = versionRun
    ? (await prisma.arenaRun.findFirst({
        where: { agentId: agent.id, metricsJson: { path: ["window"], equals: version!.window } },
        orderBy: { runAt: "asc" },
      }))?.runAt
    : undefined;

  const actions = await prisma.action.findMany({
    where: { agentId: agent.id },
    orderBy: { timestamp: "desc" },
    select: { id: true, timestamp: true, actionType: true, txHash: true, gasCost: true, result: true, latencyMs: true, paramsJson: true },
  });

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
        <BigStat label="Capital tested" value={formatBnb(agent.capitalTested)} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
          Evidence
        </h2>
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm border-t border-border pt-4">
          <Stat label="Actions executed" value={String(agent.actionsExecuted)} />
          <Stat label="Successful" value={String(agent.actionsSucceeded)} />
          <Stat label="Failed" value={String(agent.actionsFailed)} />
          <Stat label="Average gas per action" value={formatBnb(agent.avgCost)} />
          <Stat
            label="Detection to confirmed tx"
            value={agent.avgReactionTimeSec > 0 ? `${agent.avgReactionTimeSec.toFixed(1)}s` : "not yet measured"}
          />
          {agent.netYieldPct != null && (
            <Stat label={RESULT_LABELS[agent.category] ?? "Result"} value={formatSignedPct(agent.netYieldPct)} />
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
              {agent.category !== "HEALTH_FACTOR"
                ? "The agent's whole position, valued at today's price, compared against"
                : "Most recent real action, compared against"}
              : &quot;{counterfactual.baselineScenario}&quot;.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted text-xs">Actual result</div>
                <div className="mono-nums text-lg">
                  {formatOutcome(counterfactual.actualOutcome, counterfactual.unit)}
                </div>
              </div>
              <div>
                <div className="text-muted text-xs">Baseline (no action)</div>
                <div className="mono-nums text-lg">
                  {formatOutcome(counterfactual.baselineOutcome, counterfactual.unit)}
                </div>
              </div>
              <div>
                <div className="text-muted text-xs">Value created</div>
                <div className={`mono-nums text-lg ${counterfactual.valueCreated < 0 ? "text-risk-high" : "text-accent"}`}>
                  {formatOutcome(counterfactual.valueCreated, counterfactual.unit, true)}
                </div>
              </div>
            </div>
            {version && (
              <div className="mt-5 border-t border-border pt-4 text-sm">
                <div className="font-medium">
                  Strategy {version.window} on its own
                  {versionStart ? `, since ${versionStart.toISOString().slice(0, 10)}` : ""}
                </div>
                <p className="mt-1 text-muted">
                  Compared against: &quot;{version.baseline}&quot;. Holds {formatOutcome(version.actualBnb, "BNB")} vs.{" "}
                  {formatOutcome(version.baselineBnb, "BNB")} (
                  <span className={version.vsBaselinePct < 0 ? "text-risk-high" : "text-accent"}>
                    {formatSignedPct(version.vsBaselinePct)}
                  </span>
                  ). The all-time figure above still includes everything before {version.window}.
                </p>
              </div>
            )}
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
          Action log
        </h2>
        <p className="mt-2 text-sm text-muted">
          Every transaction this agent has sent, newest first. Each one opens on BscScan Testnet.
        </p>
        {actions.length > 0 ? (
          <>
            <ActionTable actions={actions.slice(0, 15)} />
            {actions.length > 15 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-muted hover:text-accent">
                  Show the other {actions.length - 15}
                </summary>
                <ActionTable actions={actions.slice(15)} />
              </details>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">No actions recorded yet.</p>
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

type ActionRow = {
  id: string;
  timestamp: Date;
  actionType: string;
  txHash: string;
  gasCost: number | null;
  result: "SUCCESS" | "FAIL";
  latencyMs: number | null;
  paramsJson: unknown;
};

function outcomeOf(a: ActionRow): { text: string; className: string } {
  if (a.result === "SUCCESS") return { text: "succeeded", className: "text-risk-low" };
  const params = (a.paramsJson ?? {}) as Record<string, unknown>;
  if (params.abandoned) return { text: "unused approval", className: "text-risk-moderate" };
  return { text: "failed", className: "text-risk-high" };
}

function ActionTable({ actions }: { actions: ActionRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-raised text-muted text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2">When (UTC)</th>
            <th className="text-left px-3 py-2">Action</th>
            <th className="text-left px-3 py-2">Outcome</th>
            <th className="text-left px-3 py-2">Gas</th>
            <th className="text-left px-3 py-2">Tx</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => {
            const outcome = outcomeOf(a);
            const note = ((a.paramsJson ?? {}) as Record<string, unknown>).note;
            return (
              <tr key={a.id} className="border-t border-border" title={typeof note === "string" ? note : undefined}>
                <td className="px-3 py-2 mono-nums whitespace-nowrap text-muted">
                  {a.timestamp.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {a.actionType.replaceAll("_", " ")}
                  {a.latencyMs != null && (
                    <span className="text-muted"> · {(a.latencyMs / 1000).toFixed(1)}s</span>
                  )}
                </td>
                <td className={`px-3 py-2 whitespace-nowrap ${outcome.className}`}>{outcome.text}</td>
                <td className="px-3 py-2 mono-nums whitespace-nowrap">{a.gasCost != null ? formatBnb(a.gasCost) : "n/a"}</td>
                <td className="px-3 py-2">
                  <a
                    href={`https://testnet.bscscan.com/tx/${a.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono-nums underline hover:text-accent"
                  >
                    {a.txHash.slice(0, 10)}…
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
