import Link from "next/link";
import { MOCK_AGENTS } from "../lib/mockData";

interface Opportunity {
  pool: string;
  currentLiquidity: string;
  volume24h: string;
  imbalancePct: number;
  potentialImprovementPct: number;
  recommendedAgentId: string;
  reason: string;
}

// TODO(week 4): compute from real PancakeSwap subgraph data (pool
// liquidity/volume/fees) via @underwrit/chain instead of this placeholder —
// this is the PancakeSwap partner-track discovery surface.
const OPPORTUNITIES: Opportunity[] = [
  {
    pool: "BNB / USDT",
    currentLiquidity: "$4.2M",
    volume24h: "$1.8M",
    imbalancePct: 6.4,
    potentialImprovementPct: 2.1,
    recommendedAgentId: "lp-optimizer-1847",
    reason: "Historically improves capital efficiency in similar pools.",
  },
  {
    pool: "CAKE / BNB",
    currentLiquidity: "$1.1M",
    volume24h: "$420K",
    imbalancePct: 11.2,
    potentialImprovementPct: 3.4,
    recommendedAgentId: "grid-runner-04",
    reason: "Grid strategy captures range-bound volatility in this pair.",
  },
];

export default function OpportunitiesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Liquidity Opportunities
      </h1>
      <p className="mt-2 text-muted max-w-2xl">
        Underwrit continuously looks for pools where an agent could improve
        PancakeSwap capital efficiency, and proposes who should do it.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {OPPORTUNITIES.map((op) => {
          const agent = MOCK_AGENTS.find((a) => a.id === op.recommendedAgentId);
          return (
            <div
              key={op.pool}
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{op.pool} Pool</div>
                <div className="text-xs text-muted">
                  {op.currentLiquidity} liquidity · {op.volume24h} 24h volume
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted text-xs">Estimated imbalance</div>
                  <div className="mono-nums">{op.imbalancePct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-muted text-xs">Potential improvement</div>
                  <div className="mono-nums text-accent">
                    +{op.potentialImprovementPct.toFixed(1)}%
                  </div>
                </div>
              </div>
              {agent && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-sm">
                    <span className="text-muted">Recommended: </span>
                    <Link
                      href={`/agents/${agent.id}`}
                      className="hover:text-accent transition-colors"
                    >
                      {agent.name}
                    </Link>
                    <div className="text-xs text-muted mt-0.5">{op.reason}</div>
                  </div>
                  <Link
                    href={`/job/new?category=${agent.category}&agent=${agent.id}`}
                    className="rounded-md bg-accent-dim text-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Hire
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
