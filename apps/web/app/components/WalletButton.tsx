"use client";

import { useState } from "react";
import { useAltanaWallet } from "../lib/useAltanaWallet";

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Persistent header control for the user's Altana wallet — a real BSC
 * Testnet smart account created via a browser passkey (WebAuthn), not a
 * mock connect-wallet button. This is what the Job Contract form and the
 * Hire flow both read `address` from.
 */
export function WalletButton() {
  const { address, loading, creating, error, create, disconnect } = useAltanaWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return null;

  if (!address) {
    return (
      <button
        onClick={() => create().catch(() => {})}
        disabled={creating}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent/50 transition-colors disabled:opacity-60"
        title={error ?? "Create a real BSC Testnet wallet with a passkey — no seed phrase, no extension"}
      >
        {creating ? "Creating wallet…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="rounded-md border border-border px-3 py-1.5 text-sm mono-nums hover:border-accent/50 transition-colors"
      >
        {short(address)}
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-surface p-2 text-sm shadow-lg z-10">
          <div className="px-2 py-1 text-xs text-muted">Altana wallet · BSC Testnet</div>
          <div className="px-2 py-1 mono-nums text-xs break-all">{address}</div>
          <button
            onClick={() => {
              disconnect();
              setMenuOpen(false);
            }}
            className="mt-1 w-full text-left px-2 py-1.5 rounded hover:bg-surface-raised text-risk-high"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
