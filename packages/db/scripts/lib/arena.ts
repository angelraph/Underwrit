/**
 * Records one Arena measurement: an agent's real holdings against its
 * category's do-nothing baseline, both valued at the same block and price.
 * Every sync adds a row, so the Arena shows a history of standings rather
 * than one number frozen on the day it was first computed.
 */

import { prisma, type Category } from "@underwrit/db";

export const ARENA_SCENARIO = "vs-do-nothing";

export async function recordArenaRun(
  agentId: string,
  category: Category,
  m: { baselineBnb: number; actualBnb: number; block: bigint; baseline: string; window?: string },
): Promise<void> {
  const vsBaselinePct = ((m.actualBnb - m.baselineBnb) / m.baselineBnb) * 100;
  await prisma.arenaRun.create({
    data: {
      category,
      scenarioId: ARENA_SCENARIO,
      agentId,
      metricsJson: {
        baseline: m.baseline,
        baselineBnb: m.baselineBnb,
        actualBnb: m.actualBnb,
        valueCreatedBnb: m.actualBnb - m.baselineBnb,
        vsBaselinePct,
        block: m.block.toString(),
        // Set when this row measures one strategy version from its own start
        // (e.g. "v2"), rather than the agent's whole history.
        ...(m.window ? { window: m.window } : {}),
      },
    },
  });
  console.log(`  arena${m.window ? ` (${m.window})` : ""}: recorded ${vsBaselinePct >= 0 ? "+" : ""}${vsBaselinePct.toFixed(2)}% vs "${m.baseline}" at block ${m.block}`);
}
