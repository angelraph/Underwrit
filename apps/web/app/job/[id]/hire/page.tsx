import { notFound } from "next/navigation";
import { MOCK_AGENTS } from "../../../lib/mockData";
import { HireButton } from "./HireButton";

export default async function HirePage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const { agent: agentId } = await searchParams;
  const agent = MOCK_AGENTS.find((a) => a.id === agentId);
  if (!agent) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="text-sm text-muted">Hire — Altana session</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        {agent.name}
      </h1>
      <p className="mt-2 text-muted">
        This grants a scoped Altana session, not custody of your wallet.
        Everything below is enforced on-chain by the Keystore contract, not
        just shown in this UI.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6 font-mono text-sm">
        <div className="text-muted uppercase tracking-wide text-xs mb-4">
          Agent Permission
        </div>
        <div className="mb-1">
          Agent: <span className="text-foreground">{agent.name}</span>
        </div>
        <div className="mt-4 mb-1 text-muted">Can:</div>
        {agent.permissions.map((p) => (
          <div key={p} className="text-risk-low">
            ✓ {p}
          </div>
        ))}
        <div className="mt-3 mb-1 text-muted">Cannot:</div>
        <div className="text-risk-high">✕ Transfer funds to external addresses</div>
        <div className="text-risk-high">✕ Approve new tokens outside the allowlist</div>
        <div className="mt-4 mb-1 text-muted">Spend limit:</div>
        <div>${agent.spendCapDaily}/day</div>
        <div className="mt-4 mb-1 text-muted">Expires:</div>
        <div>14 days from grant</div>
      </div>

      <HireButton agentId={agent.id} agentName={agent.name} />
    </div>
  );
}
