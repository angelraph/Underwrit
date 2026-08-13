import { MOCK_AGENTS } from "../lib/mockData";
import { HiresList, type MockSession } from "./HiresList";

const BASE_SESSIONS: MockSession[] = [
  {
    id: "session-1",
    agentId: "hf-guardian-01",
    spendUsed: 42.1,
    spendCap: 250,
    expiresInDays: 4,
    grantTxHash: "0x7f2a…9c31",
  },
];

export default async function HiresPage({
  searchParams,
}: {
  searchParams: Promise<{ granted?: string; agent?: string }>;
}) {
  const { granted, agent: grantedAgentId } = await searchParams;

  const sessions = [...BASE_SESSIONS];
  if (granted && grantedAgentId && !sessions.some((s) => s.agentId === grantedAgentId)) {
    sessions.unshift({
      id: `session-${grantedAgentId}`,
      agentId: grantedAgentId,
      spendUsed: 0,
      spendCap:
        MOCK_AGENTS.find((a) => a.id === grantedAgentId)?.spendCapDaily ?? 100,
      expiresInDays: 14,
      grantTxHash: "0x" + Math.random().toString(16).slice(2, 10) + "…" + Math.random().toString(16).slice(2, 6),
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

      <HiresList sessions={sessions} agents={MOCK_AGENTS} />
    </div>
  );
}
