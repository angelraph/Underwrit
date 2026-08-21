"use client";

import { useState } from "react";
import type { Address } from "viem";
import { parseEther } from "viem";
import { useAltanaWallet } from "../lib/useAltanaWallet";
import { claimTestnetU, sendTestnetBnb } from "../lib/uFaucet";

const X402_FACILITATOR_ADDRESS: Address = "0xbE3B8F9D79A51B21d972ba3EC973add9d9B02A3c";

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
  const { address, loading, creating, error, create, disconnect, getSigner } = useAltanaWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [fundResult, setFundResult] = useState<string | null>(null);

  async function handleFundFacilitator() {
    if (!address) return;
    const signer = getSigner();
    if (!signer) {
      setFundResult("Wallet signer unavailable — try reconnecting.");
      return;
    }
    setFunding(true);
    setFundResult(null);
    try {
      const result = await sendTestnetBnb(
        address as Address,
        signer,
        X402_FACILITATOR_ADDRESS,
        parseEther("0.01")
      );
      setFundResult(
        result.transactionHash ? `Sent — tx ${result.transactionHash.slice(0, 10)}…` : "Sent."
      );
    } catch (e) {
      setFundResult(e instanceof Error ? e.message : "Send failed — try again.");
    } finally {
      setFunding(false);
    }
  }

  async function handleClaimU() {
    if (!address) return;
    const signer = getSigner();
    if (!signer) {
      setClaimResult("Wallet signer unavailable — try reconnecting.");
      return;
    }
    setClaiming(true);
    setClaimResult(null);
    try {
      const result = await claimTestnetU(address as Address, signer);
      setClaimResult(
        result.transactionHash ? `Claimed — tx ${result.transactionHash.slice(0, 10)}…` : "Claimed."
      );
    } catch (e) {
      setClaimResult(e instanceof Error ? e.message : "Claim failed — try again in 30 min.");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return null;

  if (!address) {
    return (
      <button
        onClick={() => create().catch(() => {})}
        disabled={creating}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent/50 transition-colors disabled:opacity-60"
        title={error ?? "Create a real BSC Testnet wallet with a passkey. No seed phrase, no extension."}
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
            onClick={handleClaimU}
            disabled={claiming}
            className="mt-1 w-full text-left px-2 py-1.5 rounded hover:bg-surface-raised text-accent disabled:opacity-60"
          >
            {claiming ? "Claiming $U (passkey prompt)…" : "Claim testnet $U"}
          </button>
          {claimResult && (
            <div className="px-2 py-1 text-xs text-muted break-all">{claimResult}</div>
          )}
          <button
            onClick={handleFundFacilitator}
            disabled={funding}
            className="mt-1 w-full text-left px-2 py-1.5 rounded hover:bg-surface-raised text-accent disabled:opacity-60"
          >
            {funding ? "Sending 0.01 tBNB (passkey prompt)…" : "Fund x402 facilitator (0.01 tBNB)"}
          </button>
          {fundResult && (
            <div className="px-2 py-1 text-xs text-muted break-all">{fundResult}</div>
          )}
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
