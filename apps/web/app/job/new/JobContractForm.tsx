"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "../../lib/mockData";

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
  const [category, setCategory] = useState<string>(
    defaultCategory ?? categories[0]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO(week 2): POST to an API route that creates a JobSpec row via
    // @underwrit/db, runs rankAgentsForJob from @underwrit/evidence-engine,
    // and redirects to the real job id. Placeholder demo route for now so
    // the full journey is clickable end-to-end.
    router.push(`/job/demo?category=${category}`);
  }

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

      <div className="grid grid-cols-2 gap-4">
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

      <button
        type="submit"
        className="rounded-md bg-accent-dim text-background px-5 py-3 text-sm font-medium hover:bg-accent transition-colors"
      >
        Find agents
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
