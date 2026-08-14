import { scan8004, withCache, type Scan8004Agent } from "@underwrit/chain";

/**
 * Real BSC-mainnet ERC-8004 agents, pulled live from 8004scan's public API
 * — the actual "200,000 agents, no way to find them" population the
 * hackathon brief is about, distinct from Underwrit's own 4 reference
 * agents. Their scores/feedback counts are 8004scan's own reputation data,
 * not evidence Underwrit independently verified — the UI must always label
 * these as third-party, never blend them into the real-Action-log evidence
 * shown for OURS agents.
 *
 * Cached in-memory at module scope (created once per server process, not
 * per request — `withCache` closes over its own Map, so building the
 * wrapper inside a request handler would silently defeat it). The free-tier
 * key here is rate-limited to 30 req/min / 1000 req/day; a 10-minute TTL
 * keeps a live demo session nowhere near either limit without needing a
 * DB-backed cache table.
 */
const cachedListAgents = withCache(
  scan8004.listAgents,
  (params) => JSON.stringify(params),
  10 * 60 * 1000,
);

export interface DiscoveredAgent {
  tokenId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  ownerAddress: string;
  isVerified: boolean;
  totalScore: number;
  totalFeedbacks: number;
  averageScore: number;
  supportedProtocols: string[];
  profileUrl: string;
}

function toDiscoveredAgent(a: Scan8004Agent): DiscoveredAgent {
  return {
    tokenId: a.token_id,
    name: a.name || `Agent #${a.token_id}`,
    description: a.description,
    imageUrl: a.image_url,
    ownerAddress: a.owner_address,
    isVerified: a.is_verified,
    totalScore: a.total_score,
    totalFeedbacks: a.total_feedbacks,
    averageScore: a.average_score,
    supportedProtocols: a.supported_protocols ?? [],
    profileUrl: `https://8004scan.io/agents/bsc/${a.token_id}`,
  };
}

/** Top real agents on BSC mainnet by 8004scan's own quality score. Returns [] on any API/rate-limit failure rather than crash the page. */
export async function getTopDiscoveredAgents(limit = 12): Promise<DiscoveredAgent[]> {
  try {
    const res = await cachedListAgents({
      chainId: 56,
      limit,
      sortBy: "total_score",
      sortOrder: "desc",
    });
    if (!res.success) return [];
    return res.data.map(toDiscoveredAgent);
  } catch {
    return [];
  }
}

const cachedSearchAgents = withCache(
  scan8004.searchAgents,
  (q) => q,
  10 * 60 * 1000,
);

export async function searchDiscoveredAgents(query: string): Promise<DiscoveredAgent[]> {
  if (!query.trim()) return [];
  try {
    const res = await cachedSearchAgents(query);
    if (!res.success) return [];
    return res.data.filter((a) => a.chain_id === 56).map(toDiscoveredAgent);
  } catch {
    return [];
  }
}
