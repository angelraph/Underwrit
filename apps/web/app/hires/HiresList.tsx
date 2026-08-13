"use client";

import { useState } from "react";
import Link from "next/link";
import type { MockAgent } from "../lib/mockData";

export interface MockSession {
  id: string;
  agentId: string;
  spendUsed: number;
  spendCap: number;
  expiresInDays: number;
  grantTxHash: string;
}

export function HiresList({
  sessions,
  agents,
}: {
  sessions: MockSession[];
  agents: MockAgent[];
}) {
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(sessionId: string) {
    setRevoking(sessionId);
    // TODO(week 3): call an API route that runs client.revokeSession(...)
    // via @altananetwork/sdk, writes revokeTxHash + status=REVOKED on the
    // Session row. Mocked here so the revoke UX is demoable now.
    await new Promise((r) => setTimeout(r, 700));
    setRevoked((prev) => new Set(prev).add(sessionId));
    setRevoking(null);
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {sessions.map((session) => {
        const agent = agents.find((a) => a.id === session.agentId);
        if (!agent) return null;
        const isRevoked = revoked.has(session.id);
        const pctUsed = Math.min(100, (session.spendUsed / session.spendCap) * 100);

        return (
          <div
            key={session.id}
            className="rounded-lg border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between">
              <Link
                href={`/agents/${agent.id}`}
                className="font-medium hover:text-accent transition-colors"
              >
                {agent.name}
              </Link>
              <span
                className={`text-xs rounded-full border px-2 py-0.5 ${
                  isRevoked
                    ? "border-risk-high/30 text-risk-high bg-risk-high/10"
                    : "border-risk-low/30 text-risk-low bg-risk-low/10"
                }`}
              >
                {isRevoked ? "Revoked" : "Active"}
              </span>
            </div>

            <div className="mt-3 text-sm">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Spend used</span>
                <span className="mono-nums">
                  ${session.spendUsed.toFixed(2)} / ${session.spendCap}/day
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
                <div
                  className="h-full bg-accent-dim"
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Expires in {session.expiresInDays} days</span>
              <span className="mono-nums">grant tx {session.grantTxHash}</span>
            </div>

            {!isRevoked && (
              <button
                onClick={() => handleRevoke(session.id)}
                disabled={revoking === session.id}
                className="mt-4 w-full rounded-md border border-risk-high/40 text-risk-high px-3 py-2 text-sm hover:bg-risk-high/10 transition-colors disabled:opacity-60"
              >
                {revoking === session.id ? "Revoking…" : "REVOKE ACCESS"}
              </button>
            )}
          </div>
        );
      })}
      {sessions.length === 0 && (
        <p className="text-muted text-sm">No active hires yet.</p>
      )}
    </div>
  );
}
