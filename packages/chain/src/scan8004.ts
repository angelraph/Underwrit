import { SCAN8004_API_BASE } from "./addresses";

/**
 * 8004scan public REST API client.
 *
 * Rate limits (documented): anonymous 10 req/min / 100 req/day, free key
 * 30/1000, Pro 500/100000. Pro-tier keys are manual "contact us" — assume
 * anonymous tier unless SCAN8004_API_KEY is set. Callers MUST cache results
 * (see withCache below / packages/db) so the live demo never eats the daily
 * cap mid-presentation.
 */

export interface Scan8004Envelope<T> {
  success: boolean;
  data: T;
  meta: {
    version: string;
    timestamp: string;
    requestId: string;
    pagination?: { page: number; limit: number; total: number };
  };
  error?: { code: string; message: string; details?: unknown };
}

/**
 * Field names verified against a real live response from
 * https://8004scan.io/api/v1/public/agents (not assumed/speculative — the
 * original version of this interface used camelCase names like `chainId`/
 * `ownerAddress` that don't exist on the real payload at all, which meant
 * any code reading `agent.chainId` would silently get `undefined` despite
 * TypeScript claiming it was a `number`. The API is snake_case throughout.
 */
export interface Scan8004Agent {
  id: string;
  agent_id: string; // "{chainId}:{registryAddress}:{tokenId}"
  token_id: string;
  chain_id: number;
  chain_type: string;
  contract_address: string;
  is_testnet: boolean;
  owner_address: string;
  owner_ens: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  is_verified: boolean;
  star_count: number;
  supported_protocols: string[];
  x402_supported: boolean;
  total_score: number;
  rank: number | null;
  network_rank: number | null;
  health_score: number | null;
  total_feedbacks: number;
  average_score: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface RequestOpts {
  params?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<Scan8004Envelope<T>> {
  const url = new URL(`${SCAN8004_API_BASE}${path}`);
  for (const [key, value] of Object.entries(opts.params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {};
  if (process.env.SCAN8004_API_KEY) {
    headers["X-API-Key"] = process.env.SCAN8004_API_KEY;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`8004scan ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Scan8004Envelope<T>;
}

export const scan8004 = {
  listAgents: (params: {
    page?: number;
    limit?: number;
    chainId?: number;
    ownerAddress?: string;
    search?: string;
    protocol?: string;
    minScore?: number;
    maxScore?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) => request<Scan8004Agent[]>("/agents", { params }),

  getAgent: (chainId: number, tokenId: string) =>
    request<Scan8004Agent>(`/agents/${chainId}/${tokenId}`),

  searchAgents: (q: string, semanticWeight?: number) =>
    request<Scan8004Agent[]>("/agents/search", { params: { q, semanticWeight } }),

  getAgentsByOwner: (address: string) =>
    request<Scan8004Agent[]>(`/accounts/${address}/agents`),

  getStats: () => request<Record<string, unknown>>("/stats"),

  listFeedbacks: (params: { agentId?: string; chainId?: number; page?: number; limit?: number }) =>
    request<unknown[]>("/feedbacks", { params }),

  listChains: () => request<unknown[]>("/chains"),
};

/**
 * Thin memoizing wrapper — swap the get/set for packages/db-backed storage
 * (e.g. a ScanCache table keyed by URL + TTL) before the live demo so we
 * never make a live 8004scan call in front of judges.
 */
export function withCache<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  keyFn: (...args: Args) => string,
  ttlMs = 5 * 60 * 1000
) {
  const cache = new Map<string, { value: T; expiresAt: number }>();
  return async (...args: Args): Promise<T> => {
    const key = keyFn(...args);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await fn(...args);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}
