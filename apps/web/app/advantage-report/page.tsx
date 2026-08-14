import Link from "next/link";
import { getAdvantageTasks } from "../lib/advantageReport";
import { CATEGORY_LABELS, type Category } from "../lib/mockData";

export const dynamic = "force-dynamic";

export default async function AdvantageReportPage() {
  const tasks = await getAdvantageTasks();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <div className="text-sm text-muted">Agent Advantage Report</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        Does hiring an agent actually beat doing it yourself?
      </h1>
      <p className="mt-3 text-muted max-w-2xl">
        Three real tasks, each executed for real on BSC Testnet by an
        Underwrit reference agent — every transaction hash below is
        independently checkable on-chain. The agent side of each comparison
        is pulled live from this database, never hand-written. The manual
        side can&apos;t be sourced the same way — there&apos;s no literal
        control-group human to time against — so it&apos;s a reasoned
        estimate with its methodology shown, not a number presented as
        measured. These are Underwrit&apos;s own 4 reference agents — for the
        wider ~200,000-agent BSC ecosystem this project doesn&apos;t run
        itself, see{" "}
        <Link href="/discover" className="underline hover:text-accent">
          Discover on BSC
        </Link>
        .
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {tasks.map((task) => (
          <div key={task.title} className="rounded-lg border border-border bg-surface p-6">
            <div className="text-xs uppercase tracking-wide text-muted">
              {CATEGORY_LABELS[task.category as Category] ?? task.category}
            </div>
            <h2 className="text-lg font-medium mt-1">{task.title}</h2>
            <p className="mt-2 text-sm text-muted">{task.objective}</p>

            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <div className="rounded-md border border-risk-low/30 bg-risk-low/5 p-4">
                <div className="text-xs uppercase tracking-wide text-risk-low mb-2">
                  With{" "}
                  <Link href={`/agents/${task.agent.id}`} className="hover:underline">
                    {task.agent.name}
                  </Link>
                </div>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-muted">Reaction: </span>
                    {task.agent.reactionTimeDescription}
                  </div>
                  <div>
                    <span className="text-muted">Outcome: </span>
                    {task.agent.outcome}
                  </div>
                  <div>
                    <span className="text-muted">Real cost: </span>
                    <span className="mono-nums">{task.agent.totalGasCostBnb.toFixed(6)} tBNB gas</span>
                  </div>
                  <div className="text-xs text-muted break-all">
                    {task.agent.txHashes.length} tx{task.agent.txHashes.length !== 1 ? "s" : ""}:{" "}
                    {task.agent.txHashes.map((h, i) => (
                      <a
                        key={h}
                        href={`https://testnet.bscscan.com/tx/${h}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-accent mono-nums"
                      >
                        {h.slice(0, 10)}…{i < task.agent.txHashes.length - 1 ? ", " : ""}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface-raised p-4">
                <div className="text-xs uppercase tracking-wide text-muted mb-2">Doing it manually</div>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-muted">Time: </span>
                    {task.manual.timeDescription}
                  </div>
                  <div>
                    <span className="text-muted">Risk: </span>
                    {task.manual.riskDescription}
                  </div>
                  <div>
                    <span className="text-muted">Cost: </span>
                    {task.manual.costDescription}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-accent">{task.advantageSummary}</p>
          </div>
        ))}

        {tasks.length === 0 && (
          <p className="text-muted text-sm">No agent evidence synced yet.</p>
        )}
      </div>
    </div>
  );
}
