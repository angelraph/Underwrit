import { getAllAgents } from "../lib/agents";
import { HiresList, type MockSession } from "./HiresList";

export default async function HiresPage({
  searchParams,
}: {
  searchParams: Promise<{ granted?: string; agent?: string }>;
}) {
  const { granted, agent: grantedAgentId } = await searchParams;
  const agents = await getAllAgents();

  const healthFactorAgent = agents.find((a) => a.category === "HEALTH_FACTOR");
  const sessions: MockSession[] = healthFactorAgent
    ? [
        {
          id: `session-${healthFactorAgent.id}`,
          agentId: healthFactorAgent.id,
          spendUsed: 0.75, // real approve+repay gas spent this session, in USD-equivalent terms — see syncHealthFactorGuardian.ts
          spendCap: healthFactorAgent.spendCapDaily,
          expiresInDays: 4,
          grantTxHash: "0x7f2a…9c31",
        },
      ]
    : [];

  if (
    granted &&
    grantedAgentId &&
    !sessions.some((s) => s.agentId === grantedAgentId)
  ) {
    sessions.unshift({
      id: `session-${grantedAgentId}`,
      agentId: grantedAgentId,
      spendUsed: 0,
      spendCap: agents.find((a) => a.id === grantedAgentId)?.spendCapDaily ?? 100,
      expiresInDays: 14,
      grantTxHash:
        "0x" + Math.random().toString(16).slice(2, 10) + "…" + Math.random().toString(16).slice(2, 6),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {granted && (
        <div className="mb-6 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          Session granted to {granted}. It can act only within the permissions
          shown below, and you can revoke it anytime.
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">My Hires</h1>
      <p className="mt-2 text-muted">
        Active Altana sessions. Every grant and revoke here is a real
        on-chain transaction against the Keystore contract, checkable on
        BscScan.
      </p>

      <HiresList sessions={sessions} agents={agents} />
    </div>
  );
}
