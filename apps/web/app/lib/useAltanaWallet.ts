"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { getAltanaClient, signerFromPasskey, type PasskeyCredential } from "./altana";

const STORAGE_KEY = "underwrit:altana-wallet";

interface StoredWallet {
  address: Address;
  credential: PasskeyCredential;
}

/**
 * Client-side Altana wallet state. A wallet here is a real BSC Testnet
 * smart account (EIP-7702, Porto-based) controlled by a browser passkey —
 * not a mock. `PasskeyCredential` is JSON-safe by design (see
 * @altananetwork/sdk's own docs on the type), so persisting it in
 * localStorage and rehydrating via `signerFromPasskey` is the SDK's own
 * intended pattern, not a workaround.
 *
 * The private key never leaves the device's secure enclave — only the
 * credential ID + public key are stored here, and every signature still
 * requires a fresh biometric/WebAuthn prompt.
 */
export function useAltanaWallet() {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // localStorage doesn't exist during SSR, so this can't be a lazy
      // useState initializer; it has to run after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setWallet(JSON.parse(raw) as StoredWallet);
    } catch {
      // corrupted/unavailable storage — treat as no wallet rather than crash
    } finally {
      setLoading(false);
    }
  }, []);

  // createPasskeyWallet always registers a brand-new WebAuthn credential,
  // which always means a brand-new smart-account address, so it must never
  // be a silent fallback for a failed/ambiguous recovery attempt — that
  // just breeds more orphaned wallets. recover() and create() are kept as
  // two separate, explicit actions instead of one that guesses.
  const recover = useCallback(async (): Promise<StoredWallet> => {
    setCreating(true);
    setError(null);
    try {
      const client = getAltanaClient();
      const result = await client.recoverFromPasskey();
      const stored: StoredWallet = { address: result.address, credential: result.signer.credential };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setWallet(stored);
      return stored;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't find an existing wallet";
      setError(message);
      throw e;
    } finally {
      setCreating(false);
    }
  }, []);

  const create = useCallback(async (): Promise<StoredWallet> => {
    setCreating(true);
    setError(null);
    try {
      const client = getAltanaClient();
      const result = await client.createPasskeyWallet({ name: "Underwrit" });
      const stored: StoredWallet = { address: result.address, credential: result.signer.credential };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setWallet(stored);
      return stored;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create wallet";
      setError(message);
      throw e;
    } finally {
      setCreating(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setWallet(null);
  }, []);

  const getSigner = useCallback(() => {
    if (!wallet) return null;
    return signerFromPasskey(wallet.credential);
  }, [wallet]);

  return { address: wallet?.address ?? null, loading, creating, error, recover, create, disconnect, getSigner };
}
