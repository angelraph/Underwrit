import { prisma } from "@underwrit/db";
import { getAllAgents } from "../lib/agents";
import { HiresList } from "./HiresList";

export default async function HiresPage({
  searchParams,
}: {
  searchParams: Promise<{ granted?: string; agent?: string }>;
}) {
  const { granted } = await searchParams;
  const [agents, sessions] = await Promise.all([
    getAllAgents(),
    prisma.session.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

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
        Real Altana sessions. Every grant and revoke here is a real on-chain
        transaction against the Keystore contract, checkable on{" "}
        <a href="https://explorer.altana.network" target="_blank" rel="noreferrer" className="underline hover:text-accent">
          Altana&apos;s explorer
        </a>
        .
      </p>

      <HiresList
        sessions={sessions.map((s) => ({
          id: s.id,
          agentId: s.agentId,
          walletAddress: s.walletAddress,
          altanaSessionId: s.altanaSessionId,
          permissionsJson: s.permissionsJson as { calls?: { to?: string }[]; spend?: { limit: string; period: string }[] },
          expiry: s.expiry.toISOString(),
          status: s.status,
          grantTxHash: s.grantTxHash,
          revokeTxHash: s.revokeTxHash,
        }))}
        agents={agents}
      />
    </div>
  );
}
