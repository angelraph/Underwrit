import Link from "next/link";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "./lib/mockData";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          What do you want an agent to accomplish?
        </h1>
        <p className="mt-3 text-muted">
          Describe a job and its constraints. Underwrit scores every eligible
          agent on real evidence — not a profile — then hires the winner
          under a spending cap you set and can revoke.
        </p>
      </div>

      <form
        action="/job/new"
        className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl"
      >
        <input
          name="objective"
          placeholder='e.g. "Protect my Venus position from liquidation"'
          className="flex-1 rounded-md border border-border bg-surface px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          className="rounded-md bg-accent-dim text-background px-5 py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          Find agents
        </button>
      </form>

      <div className="mt-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
            Browse by category
          </h2>
          <Link href="/categories" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_ORDER.map((category) => (
            <Link
              key={category}
              href={`/categories/${category.toLowerCase()}`}
              className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
            >
              <div className="font-medium">{CATEGORY_LABELS[category]}</div>
              <div className="text-sm text-muted mt-1">
                {CATEGORY_DESCRIPTIONS[category]}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <Link
          href="/arena"
          className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
        >
          <div className="font-medium">Agent Arena</div>
          <div className="text-muted mt-1">
            Every agent ranked on its own real, on-chain evidence.
          </div>
        </Link>
        <Link
          href="/opportunities"
          className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
        >
          <div className="font-medium">Liquidity Opportunities</div>
          <div className="text-muted mt-1">
            Where an agent could improve PancakeSwap pool efficiency right now.
          </div>
        </Link>
        <Link
          href="/hires"
          className="rounded-lg border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
        >
          <div className="font-medium">My Hires</div>
          <div className="text-muted mt-1">
            Active sessions, spend used, one-click revoke.
          </div>
        </Link>
      </div>
    </div>
  );
}
