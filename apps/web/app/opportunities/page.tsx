import Link from "next/link";
import { getWbnbUsdtFeeTierStates } from "../lib/liquidityOpportunities";
import { getAllAgents } from "../lib/agents";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const [tiers, agents] = await Promise.all([getWbnbUsdtFeeTierStates(), getAllAgents()]);
  const rebalancer = agents.find((a) => a.category === "REBALANCING" && a.walletAddress);

  const active = tiers.filter((t) => t.exists);
  const uninitialized = tiers.filter((t) => !t.exists);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Liquidity Opportunities
      </h1>
      <p className="mt-2 text-muted max-w-2xl">
        Live PancakeSwap V3 pool state for WBNB/USDT on BSC Testnet, read
        directly from the Factory and each pool contract — not a historical
        volume/imbalance estimate, which would need a subgraph this project
        doesn&apos;t run. What you can genuinely tell from a single on-chain
        read: which fee tiers actually have liquidity right now, and which
        are sitting completely uninitialized.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <div className="font-medium">WBNB / USDT</div>
        <div className="mt-4 grid gap-3">
          {tiers.map((t) => (
            <div
              key={t.fee}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 rounded-md border px-4 py-3 text-sm ${
                t.exists ? "border-risk-low/30 bg-risk-low/5" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="mono-nums font-medium">{t.feeLabel}</span>
                <span className={t.exists ? "text-risk-low" : "text-muted"}>
                  {t.exists ? "Active" : "Uninitialized — no LP yet"}
                </span>
              </div>
              {t.exists ? (
                <div className="text-xs text-muted mono-nums">
                  liquidity {t.liquidity?.toString()} · tick {t.tick}
                </div>
              ) : (
                <a
                  href={`https://testnet.bscscan.com/address/${t.poolAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted underline hover:text-accent"
                >
                  pool address
                </a>
              )}
            </div>
          ))}
        </div>

        {uninitialized.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            {uninitialized.map((t) => t.feeLabel).join(", ")} {uninitialized.length === 1 ? "tier has" : "tiers have"} zero
            liquidity on this pair right now — whoever initializes {uninitialized.length === 1 ? "it" : "one"} first captures
            100% of that tier&apos;s fee revenue with no competition, at least until someone else notices too.
          </p>
        )}

        {rebalancer && (
          <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
            <div className="text-sm">
              <span className="text-muted">Manages the active tier today: </span>
              <Link href={`/agents/${rebalancer.id}`} className="hover:text-accent transition-colors">
                {rebalancer.name}
              </Link>
              <div className="text-xs text-muted mt-0.5">
                Real, deployed, currently running a concentrated position on this exact pool — see its Performance Passport for the actual on-chain history.
              </div>
            </div>
            <Link
              href={`/job/new?category=REBALANCING`}
              className="rounded-md bg-accent-dim text-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Hire
            </Link>
          </div>
        )}
      </div>

      {active.length === 0 && (
        <p className="mt-6 text-sm text-muted">
          No initialized WBNB/USDT pool found on this fee tier set right now — check back once the reference pool is seeded.
        </p>
      )}
    </div>
  );
}
