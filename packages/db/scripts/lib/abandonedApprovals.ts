/**
 * An approval only exists to let one specific follow-up call happen (a
 * swap, a mint, a repay). If that call never came, the run stopped partway
 * and the approval was wasted gas. Counting it as a success would let a
 * crash loop pad an agent's track record, which is exactly what happened
 * with the Rebalancer from Sep 1 to Sep 11 2026: nearly every 6-hourly run
 * approved USDT and WBNB for the position manager, then crashed before
 * increaseLiquidity (the call was missing from its hand-written ABI). Each
 * approval succeeded on-chain; the action it was for never happened.
 *
 * So an approval with no matching follow-up within the same run is
 * recorded as a failed action, with a note saying why, while the tx itself
 * is left exactly as the chain shows it.
 */

import { ActionResult, prisma } from "@underwrit/db";

const SAME_RUN_MS = 15 * 60 * 1000;

const FOLLOW_UPS: Record<string, (actionType: string) => boolean> = {
  SmartRouter: (t) => t.startsWith("swap_") || t === "buy_wbnb" || t === "sell_wbnb",
  NonfungiblePositionManager: (t) => t === "mint_position" || t === "deploy_idle_dust",
  vUSDT: (t) => t === "repay",
};

const NOTE =
  "Approval succeeded on-chain, but the run stopped before the call it was for, so it's counted as a failed action.";

export async function markAbandonedApprovals(agentId: string): Promise<void> {
  const actions = await prisma.action.findMany({ where: { agentId }, orderBy: { timestamp: "asc" } });
  let marked = 0;
  for (const [i, a] of actions.entries()) {
    if (a.actionType !== "approve" && a.actionType !== "approve_repay") continue;
    const params = (a.paramsJson ?? {}) as Record<string, unknown>;
    const spender = a.actionType === "approve_repay" ? "vUSDT" : (params.spender as string | undefined);
    const isFollowUp = spender ? FOLLOW_UPS[spender] : undefined;
    if (!isFollowUp || params.abandoned) continue;

    const usedLater = actions
      .slice(i + 1)
      .some((b) => b.timestamp.getTime() - a.timestamp.getTime() <= SAME_RUN_MS && isFollowUp(b.actionType));
    if (usedLater) continue;

    // Don't judge an approval from the run that's still in progress.
    if (Date.now() - a.timestamp.getTime() < SAME_RUN_MS) continue;

    await prisma.action.update({
      where: { id: a.id },
      data: { result: ActionResult.FAIL, paramsJson: { ...params, abandoned: true, note: NOTE } },
    });
    marked++;
  }
  if (marked > 0) console.log(`  approvals: ${marked} never used by the run that made them, counted as failed`);
}
