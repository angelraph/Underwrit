"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient, http, parseEther, formatEther, type Address } from "viem";
import { getAltanaClient, BNB_TESTNET } from "../../../lib/altana";
import { useAltanaWallet } from "../../../lib/useAltanaWallet";
import { REAL_SESSION_SPEND_CAP_TBNB, BSC_TESTNET_FAUCET_URL } from "../../../lib/altanaHire";

const MIN_BALANCE_WEI = parseEther("0.01"); // covers the grant tx's own gas

const publicClient = createPublicClient({ chain: BNB_TESTNET.chain, transport: http(BNB_TESTNET.publicRpcUrl) });

type Phase = "creating" | "checking-balance" | "needs-funds" | "ready" | "granting" | "error";

export function HireButton({
  jobSpecId,
  dbAgentId,
  agentName,
  agentWalletAddress,
  expiryDays,
}: {
  jobSpecId: string;
  dbAgentId: string;
  agentName: string;
  agentWalletAddress: string;
  expiryDays: number;
}) {
  const router = useRouter();
  const { address, loading: walletLoading, create, getSigner } = useAltanaWallet();
  const [phase, setPhase] = useState<Phase>("checking-balance");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkBalance = useCallback(async (addr: Address) => {
    const bal = await publicClient.getBalance({ address: addr });
    setBalance(bal);
    setPhase(bal >= MIN_BALANCE_WEI ? "ready" : "needs-funds");
  }, []);

  useEffect(() => {
    if (walletLoading || !address) return;
    // checkBalance is an async read against live chain state (an external
    // system); its setState calls only run after the awaited RPC call
    // resolves, not synchronously within this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkBalance(address as Address).catch(() => setPhase("error"));
  }, [address, walletLoading, checkBalance]);

  async function handleCreateWallet() {
    setPhase("creating");
    setError(null);
    try {
      const wallet = await create();
      setPhase("checking-balance");
      await checkBalance(wallet.address);
    } catch {
      setError("Couldn't create a wallet. Try again.");
      setPhase("checking-balance");
    }
  }

  async function handleGrant() {
    if (!address) return;
    const signer = getSigner();
    if (!signer) {
      setError("Wallet signer unavailable. Try reconnecting.");
      return;
    }

    setPhase("granting");
    setError(null);
    try {
      const client = getAltanaClient();
      const expiry = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;
      const permissions = {
        calls: [{ to: agentWalletAddress as Address }],
        spend: [{ limit: parseEther(REAL_SESSION_SPEND_CAP_TBNB), period: "day" as const }],
      };

      const result = await client.grantSession({
        wallet: { address },
        signer,
        permissions,
        expiry,
        chainId: BNB_TESTNET.chainId,
      });

      // permissions.spend[].limit is a bigint — JSON.stringify can't
      // serialize that directly, so store the DB-facing copy with it
      // stringified (the real on-chain call above already used the bigint).
      const permissionsForDb = {
        calls: permissions.calls,
        spend: permissions.spend.map((s) => ({ ...s, limit: s.limit.toString() })),
      };

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobSpecId,
          agentId: dbAgentId,
          walletAddress: address,
          altanaSessionId: result.publicKey,
          permissionsJson: permissionsForDb,
          expiry,
          grantTxHash: result.transactionHash,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save the session");
      }

      router.push(`/hires?granted=${encodeURIComponent(agentName)}&agent=${dbAgentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grant failed");
      setPhase("ready");
    }
  }

  if (walletLoading) {
    return <div className="mt-8 text-sm text-muted">Loading wallet…</div>;
  }

  if (!address || phase === "creating") {
    return (
      <div className="mt-8">
        <button
          onClick={handleCreateWallet}
          disabled={phase === "creating"}
          className="w-full rounded-md bg-accent-dim text-background px-5 py-3 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
        >
          {phase === "creating" ? "Creating wallet (passkey prompt)…" : "Create Altana Wallet to Hire"}
        </button>
        {error && <p className="mt-2 text-sm text-risk-high">{error}</p>}
      </div>
    );
  }

  if (phase === "checking-balance") {
    return <div className="mt-8 text-sm text-muted">Checking wallet balance…</div>;
  }

  if (phase === "needs-funds") {
    return (
      <div className="mt-8 rounded-md border border-border bg-surface p-4 text-sm">
        <p>
          Your wallet needs a little testnet BNB to cover the grant transaction&apos;s gas
          {balance !== null && (
            <>. Currently holds {formatEther(balance)} tBNB, needs at least {formatEther(MIN_BALANCE_WEI)}.</>
          )}
        </p>
        <p className="mt-2 mono-nums break-all text-xs text-muted">{address}</p>
        <p className="mt-3 text-xs text-muted">
          Heads up: BNB Chain&apos;s testnet faucet only pays out to an address that already
          holds a small amount of real mainnet BNB (it&apos;s an anti-abuse check on their
          side, not ours). If you don&apos;t have any mainnet BNB in another wallet, claim
          testnet BNB to a wallet that does, then send a small amount over to the address
          above.
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href={BSC_TESTNET_FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center rounded-md border border-border px-3 py-2 hover:border-accent/50 transition-colors"
          >
            Open testnet faucet
          </a>
          <button
            onClick={() => {
              if (!address) return;
              setPhase("checking-balance");
              checkBalance(address as Address).catch(() => setPhase("error"));
            }}
            className="flex-1 rounded-md bg-accent-dim text-background px-3 py-2 hover:bg-accent transition-colors"
          >
            I&apos;ve funded it, check again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        onClick={handleGrant}
        disabled={phase === "granting"}
        className="w-full rounded-md bg-accent-dim text-background px-5 py-3 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
      >
        {phase === "granting" ? "Granting session (passkey prompt)…" : "Grant Session & Hire"}
      </button>
      {error && <p className="mt-2 text-sm text-risk-high">{error}</p>}
    </div>
  );
}
