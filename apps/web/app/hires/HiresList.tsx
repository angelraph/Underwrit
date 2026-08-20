"use client";

import { useState } from "react";
import Link from "next/link";
import type { Address, Hex } from "viem";
import { formatEther } from "viem";
import type { MockAgent } from "../lib/mockData";
import { getAltanaClient, BNB_TESTNET } from "../lib/altana";
import { useAltanaWallet } from "../lib/useAltanaWallet";

export interface RealSession {
  id: string;
  agentId: string;
  walletAddress: string;
  altanaSessionId: string | null;
  permissionsJson: { calls?: { to?: string }[]; spend?: { limit: string; period: string }[] };
  expiry: string; // ISO
  status: string;
  grantTxHash: string | null;
  revokeTxHash: string | null;
}

// Both grant and revoke happen on BSC Testnet (see altana.ts, BNB_TESTNET),
// so every real tx hash the Altana SDK returns resolves directly here. Never
// hand-build a BscScan URL from anything other than a hash we got straight
// back from client.grantSession/revokeSession.
function bscTestnetTxUrl(hash: string): string {
  return `https://testnet.bscscan.com/tx/${hash}`;
}

export function HiresList({ sessions, agents }: { sessions: RealSession[]; agents: MockAgent[] }) {
  const { address, getSigner } = useAltanaWallet();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleRevoke(session: RealSession) {
    if (!session.altanaSessionId) {
      setErrors((e) => ({ ...e, [session.id]: "No session key on record. Nothing to revoke on-chain." }));
      return;
    }
    if (!address || session.walletAddress.toLowerCase() !== address.toLowerCase()) {
      setErrors((e) => ({ ...e, [session.id]: "Connect the wallet that granted this session to revoke it." }));
      return;
    }
    const signer = getSigner();
    if (!signer) {
      setErrors((e) => ({ ...e, [session.id]: "Wallet signer unavailable." }));
      return;
    }

    setRevoking(session.id);
    setErrors((e) => ({ ...e, [session.id]: "" }));
    try {
      const client = getAltanaClient();
      const result = await client.revokeSession({
        wallet: { address: address as Address },
        signer,
        session: session.altanaSessionId as Hex,
        chainId: BNB_TESTNET.chainId,
      });

      const res = await fetch(`/api/sessions/${session.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeTxHash: result.transactionHash }),
      });
      if (!res.ok) throw new Error("Revoked on-chain, but failed to update the record. Refresh to check.");

      setLocalStatus((s) => ({ ...s, [session.id]: "REVOKED" }));
    } catch (e) {
      setErrors((err) => ({ ...err, [session.id]: e instanceof Error ? e.message : "Revoke failed" }));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {sessions.map((session) => {
        const agent = agents.find((a) => a.id === session.agentId);
        if (!agent) return null;
        const status = localStatus[session.id] ?? session.status;
        const isRevoked = status === "REVOKED";
        const spend = session.permissionsJson.spend?.[0];
        const target = session.permissionsJson.calls?.[0]?.to;

        return (
          <div key={session.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <Link href={`/agents/${agent.id}`} className="font-medium hover:text-accent transition-colors">
                {agent.name}
              </Link>
              <span
                className={`text-xs rounded-full border px-2 py-0.5 ${
                  isRevoked
                    ? "border-risk-high/30 text-risk-high bg-risk-high/10"
                    : "border-risk-low/30 text-risk-low bg-risk-low/10"
                }`}
              >
                {isRevoked ? "Revoked" : status === "EXPIRED" ? "Expired" : "Active"}
              </span>
            </div>

            <div className="mt-3 text-sm text-muted">
              {spend && (
                <div>
                  Spend cap: {formatEther(BigInt(spend.limit))} tBNB / {spend.period}
                </div>
              )}
              {target && <div className="text-xs mt-1 break-all">Scoped to: {target}</div>}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Expires {new Date(session.expiry).toLocaleString()}</span>
              {session.grantTxHash && (
                <a
                  href={bscTestnetTxUrl(session.grantTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-nums underline hover:text-accent transition-colors"
                >
                  grant tx {session.grantTxHash.slice(0, 10)}…
                </a>
              )}
            </div>
            {isRevoked && session.revokeTxHash && (
              <div className="mt-1 text-xs text-muted mono-nums">
                <a
                  href={bscTestnetTxUrl(session.revokeTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-accent transition-colors"
                >
                  revoke tx {session.revokeTxHash.slice(0, 10)}…
                </a>
              </div>
            )}

            {errors[session.id] && <p className="mt-2 text-xs text-risk-high">{errors[session.id]}</p>}

            {!isRevoked && (
              <button
                onClick={() => handleRevoke(session)}
                disabled={revoking === session.id}
                className="mt-4 w-full rounded-md border border-risk-high/40 text-risk-high px-3 py-2 text-sm hover:bg-risk-high/10 transition-colors disabled:opacity-60"
              >
                {revoking === session.id ? "Revoking…" : "REVOKE ACCESS"}
              </button>
            )}
          </div>
        );
      })}
      {sessions.length === 0 && <p className="text-muted text-sm">No active hires yet.</p>}
    </div>
  );
}
