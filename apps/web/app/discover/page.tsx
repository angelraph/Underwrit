import Link from "next/link";
import { getTopDiscoveredAgents, searchDiscoveredAgents, type DiscoveredAgent } from "../lib/discover";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const agents = q ? await searchDiscoveredAgents(q) : await getTopDiscoveredAgents();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Discover on BSC</h1>
      <p className="mt-2 text-muted max-w-2xl">
        Real ERC-8004 agents already registered on BSC mainnet, pulled live from{" "}
        <a href="https://8004scan.io" target="_blank" rel="noreferrer" className="underline hover:text-accent">
          8004scan
        </a>{" "}
        — over 200,000 of them exist and this is the actual discoverability problem the whole marketplace is
        answering. These are separate from{" "}
        <Link href="/categories" className="underline hover:text-accent">
          Underwrit&apos;s own 4 reference agents
        </Link>
        : the scores and feedback counts here are 8004scan&apos;s own reputation data, not evidence Underwrit has
        independently verified (see the real{" "}
        <Link href="/advantage-report" className="underline hover:text-accent">
          Agent Advantage Report
        </Link>{" "}
        for that), so the two are never blended together.
      </p>

      <form className="mt-6 flex gap-2" action="/discover">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or description…"
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          className="rounded-md bg-accent-dim text-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          Search
        </button>
      </form>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <DiscoveredAgentCard key={agent.tokenId} agent={agent} />
        ))}
      </div>

      {agents.length === 0 && (
        <p className="mt-8 text-sm text-muted">
          {q
            ? `No BSC mainnet agents found matching "${q}".`
            : "8004scan is unreachable or rate-limited right now — try again shortly."}
        </p>
      )}
    </div>
  );
}

function DiscoveredAgentCard({ agent }: { agent: DiscoveredAgent }) {
  return (
    <a
      href={agent.profileUrl}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{agent.name}</div>
          <div className="text-xs text-muted mt-0.5">
            Third-party · 8004scan{agent.isVerified ? " · Verified" : ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="mono-nums text-lg font-semibold text-accent">{agent.totalScore.toFixed(0)}</div>
          <div className="text-[10px] text-muted uppercase tracking-wide">8004scan score</div>
        </div>
      </div>

      {agent.description && <p className="text-sm text-muted line-clamp-2">{agent.description}</p>}

      <div className="flex items-center justify-between text-xs text-muted border-t border-border pt-3">
        <span>
          {agent.totalFeedbacks} feedback{agent.totalFeedbacks !== 1 ? "s" : ""}
          {agent.totalFeedbacks > 0 ? ` · ${agent.averageScore.toFixed(0)} avg` : ""}
        </span>
        {agent.supportedProtocols.length > 0 && <span>{agent.supportedProtocols.join(", ")}</span>}
      </div>
    </a>
  );
}
