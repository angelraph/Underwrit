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
      if (raw) setWallet(JSON.parse(raw) as StoredWallet);
    } catch {
      // corrupted/unavailable storage — treat as no wallet rather than crash
    } finally {
      setLoading(false);
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

  return { address: wallet?.address ?? null, loading, creating, error, create, disconnect, getSigner };
}
