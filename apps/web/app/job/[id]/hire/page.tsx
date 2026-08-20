import { notFound } from "next/navigation";
import { prisma } from "@underwrit/db";
import type { JobConstraints } from "@underwrit/evidence-engine";
import { getAgentById } from "../../../lib/agents";
import { HireButton } from "./HireButton";
import { REAL_SESSION_SPEND_CAP_TBNB } from "../../../lib/altanaHire";

export default async function HirePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { id: jobSpecId } = await params;
  const { agent: agentId } = await searchParams;

  const [jobSpec, agent] = await Promise.all([
    prisma.jobSpec.findUnique({ where: { id: jobSpecId } }),
    agentId ? getAgentById(agentId) : Promise.resolve(undefined),
  ]);
  if (!jobSpec || !agent) notFound();

  const constraints = jobSpec.constraintsJson as unknown as JobConstraints;
  const expiryDays = constraints.expiryDays ?? 14;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <div className="text-sm text-muted">Hire: Altana session</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        {agent.name}
      </h1>
      <p className="mt-2 text-muted">
        This grants a scoped Altana session, not custody of your wallet.
        Everything below is enforced on-chain by the Keystore contract, not
        just shown in this UI. Checkable on{" "}
        <a href="https://explorer.altana.network" target="_blank" rel="noreferrer" className="underline hover:text-accent">
          Altana&apos;s explorer
        </a>
        .
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6 font-mono text-sm">
        <div className="text-muted uppercase tracking-wide text-xs mb-4">
          Agent Permission
        </div>
        <div className="mb-1">
          Agent: <span className="text-foreground">{agent.name}</span>
        </div>
        {agent.walletAddress && (
          <div className="mb-1 text-xs text-muted break-all">
            Target address: {agent.walletAddress}
          </div>
        )}
        <div className="mt-4 mb-1 text-muted">Can:</div>
        <div className="text-risk-low">✓ Receive calls/transfers from your wallet, within the spend cap below</div>
        <div className="mt-3 mb-1 text-muted">Cannot:</div>
        <div className="text-risk-high">✕ Act on your wallet outside this one target address</div>
        <div className="text-risk-high">✕ Spend beyond the cap, or after expiry</div>
        <div className="mt-4 mb-1 text-muted">Spend limit (real, on-chain enforced):</div>
        <div>{REAL_SESSION_SPEND_CAP_TBNB} tBNB/day</div>
        <div className="mt-4 mb-1 text-muted">Expires:</div>
        <div>{expiryDays} days from grant</div>
      </div>

      {agent.walletAddress ? (
        <HireButton
          jobSpecId={jobSpec.id}
          dbAgentId={agent.id}
          agentName={agent.name}
          agentWalletAddress={agent.walletAddress}
          expiryDays={expiryDays}
        />
      ) : (
        <p className="mt-8 text-sm text-muted rounded-md border border-border bg-surface p-4">
          This agent doesn&apos;t have a real deployed wallet yet. Hiring isn&apos;t available until it does.
        </p>
      )}
    </div>
  );
}
