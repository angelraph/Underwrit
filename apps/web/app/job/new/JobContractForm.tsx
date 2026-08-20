"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "../../lib/mockData";
import { useAltanaWallet } from "../../lib/useAltanaWallet";

export function JobContractForm({
  categories,
  categoryLabels,
  defaultCategory,
  defaultObjective,
}: {
  categories: Category[];
  categoryLabels: Record<Category, string>;
  defaultCategory?: string;
  defaultObjective?: string;
}) {
  const router = useRouter();
  const { address, loading: walletLoading, creating, create } = useAltanaWallet();
  const [category, setCategory] = useState<string>(
    defaultCategory ?? categories[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formEl = e.currentTarget;
    let userAddress = address;
    if (!userAddress) {
      try {
        const wallet = await create();
        userAddress = wallet.address;
      } catch {
        setError("Couldn't create a wallet. Try again.");
        return;
      }
    }

    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress,
          objectiveText: String(form.get("objective") ?? ""),
          category,
          constraints: {
            maxCapital: Number(form.get("maxCapital")),
            maxDailySpend: Number(form.get("maxDailySpend")),
            maxDrawdownPct: Number(form.get("maxDrawdownPct")),
            allowedProtocols: [],
            withdrawalsAllowed: form.get("withdrawalsAllowed") === "on",
            expiryDays: Number(form.get("expiryDays")),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status} ${res.statusText}`);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/job/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || creating || walletLoading;

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <Field label="Objective">
        <textarea
          name="objective"
          defaultValue={defaultObjective}
          rows={2}
          placeholder='e.g. "I have $5,000 in BNB/USDT liquidity. Improve my yield."'
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:border-accent/60"
        />
      </Field>

      <Field label="Category">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm focus:outline-none focus:border-accent/60"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Max capital ($)">
          <input
            type="number"
            name="maxCapital"
            defaultValue={5000}
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm mono-nums focus:outline-none focus:border-accent/60"
          />
        </Field>
        <Field label="Max daily spend ($)">
          <input
            type="number"
            name="maxDailySpend"
            defaultValue={20}
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm mono-nums focus:outline-none focus:border-accent/60"
          />
        </Field>
        <Field label="Max drawdown (%)">
          <input
            type="number"
            name="maxDrawdownPct"
            defaultValue={3}
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm mono-nums focus:outline-none focus:border-accent/60"
          />
        </Field>
        <Field label="Session expiry (days)">
          <input
            type="number"
            name="expiryDays"
            defaultValue={14}
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm mono-nums focus:outline-none focus:border-accent/60"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="withdrawalsAllowed" className="accent-accent" />
        Allow withdrawals
      </label>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent-dim text-background px-5 py-3 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
      >
        {creating ? "Creating wallet…" : submitting ? "Finding agents…" : !address ? "Connect wallet & find agents" : "Find agents"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
