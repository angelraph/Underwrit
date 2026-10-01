import type { AgentView } from "./catalog";
import { getRealAgents } from "./realAgents";

/**
 * The single source every page reads agents from: Postgres, nothing else.
 * If the database can't be reached the error propagates to app/error.tsx,
 * which says so plainly. Serving placeholder agents instead would put
 * made-up evidence on screen dressed as the real thing.
 */
export async function getAllAgents(): Promise<AgentView[]> {
  return getRealAgents();
}

export async function getAgentById(id: string): Promise<AgentView | undefined> {
  const all = await getAllAgents();
  return all.find((a) => a.id === id);
}
