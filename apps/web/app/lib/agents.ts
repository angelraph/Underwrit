import { MOCK_AGENTS, type MockAgent } from "./mockData";
import { getRealAgentsAsMockShape } from "./realAgents";

/**
 * The single source every page reads agents from. Real (DB-backed,
 * Prisma-sourced) agents replace the mock placeholder for their category as
 * each reference agent goes live — the Health Factor Guardian is the first
 * (see packages/db/scripts/syncHealthFactorGuardian.ts). Categories without
 * a real agent yet keep their mock entry so every screen still renders.
 */
export async function getAllAgents(): Promise<MockAgent[]> {
  let real: MockAgent[] = [];
  try {
    real = await getRealAgentsAsMockShape();
  } catch (e) {
    // DB unreachable (e.g. local dev without DATABASE_URL) — fall back to
    // mock-only rather than breaking every page.
    console.error("getAllAgents: falling back to mock data —", e);
  }
  const realCategories = new Set(real.map((a) => a.category));
  const mockFallback = MOCK_AGENTS.filter((a) => !realCategories.has(a.category));
  return [...real, ...mockFallback];
}

export async function getAgentById(id: string): Promise<MockAgent | undefined> {
  const all = await getAllAgents();
  return all.find((a) => a.id === id);
}
