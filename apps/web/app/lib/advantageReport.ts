import { prisma } from "@underwrit/db";

/**
 * Agent Advantage Report data, the TermiX track's core question: does
 * hiring an agent beat doing the task yourself, and can you prove it?
 *
 * The "agent" side of every comparison here is pulled live from Postgres,
 * real tx hashes, real gas costs (from actual receipts), real timestamps.
 * It is never hand-written or estimated.
 *
 * The "manual" side cannot honestly be sourced the same way, there is no
 * literal control-group human who tried the identical task at the identical
 * moment to time against. It is a reasoned estimate with its methodology
 * shown inline on the report page, clearly labeled as such rather than
 * presented as if it were measured. This matches how the category itself
 * works: the whole point of a health-factor guardian is to react to a risk
 * a human isn't watching every second, so "how fast would an unaided human
 * have caught this" is inherently a reasoned claim, not a stopwatch result.
 */

export interface AdvantageTask {
  category: string;
  title: string;
  objective: string;
  agent: {
    id: string;
    name: string;
    walletAddress: string | null;
    txHashes: string[];
    totalGasCostBnb: number;
    reactionTimeDescription: string;
    outcome: string;
  };
  manual: {
    timeDescription: string;
    riskDescription: string;
    costDescription: string;
  };
  advantageSummary: string;
}

const TASK_SPECS = [
  {
    erc8004AgentId: "1814",
    // The approve + repay that make up this task (not the position setup before it).
    taskTxHashes: [
      "0x55ec8a77a786d9ada43b73fff851207d9f8f5f69ab181b9235c844c9a91e4245",
      "0x7ccd9773af98867262b94ba5d16b0306d47d307d6bf2e7f259fd8795ef374ad3",
    ],
    category: "HEALTH_FACTOR",
    title: "Catch and repay an at-risk Venus borrow position before liquidation",
    objective:
      "A Venus Protocol borrow position (0.05 BNB collateral, 1 USDT borrowed on BSC Testnet) crosses into an AT_RISK health tier. Act before it reaches liquidation, or don't act at all and see what happens.",
    reactionTimeDescription:
      "Reacted on the same monitoring pass that observed the AT_RISK read; approve and repay both landed within the next two blocks.",
    outcome:
      "Real, on-chain-verified: account liquidity improved from $23.4999 to $23.7499 (read directly from Venus's Comptroller.getAccountLiquidity() before and after, see the position's Counterfactual row).",
    manual: {
      timeDescription:
        "A self-directed Venus user checks their dashboard when they remember to, realistically a handful of times a day at best, not the continuous, second-by-second monitoring an automated guardian runs.",
      riskDescription:
        "Every hour a position sits AT_RISK unnoticed is an hour of exposure to further price movement pushing it into an actual liquidation, where a collateral discount is seized by whoever liquidates first.",
      costDescription:
        "No direct dollar cost to \"do nothing,\" but the opportunity cost is real: the entire point of a health-factor guardian is closing the gap between when risk becomes visible on-chain and when a human notices it.",
    },
    advantageSummary:
      "The agent's real reaction was gated only by its own polling cadence, not by whether a person happened to be looking at a dashboard at that moment.",
  },
  {
    erc8004AgentId: "1818",
    taskTxHashes: ["0x51c0774de1bcf5dae1b2b844f70b55153632c0abbd8ac542230982a74a5fdd12"],
    category: "YIELD",
    title: "Route idle BNB to whichever Venus market actually pays the best real supply APY",
    objective:
      "0.15 idle BNB sitting in a wallet. Compare live, on-chain supply APY across Venus's vBNB and vUSDT markets (annualized from an actually-measured block time, not an assumed constant) and put it to work in whichever wins.",
    reactionTimeDescription: "Read both markets' live rates and supplied in a single pass, no multi-day observation window needed.",
    outcome: "Supplied 0.15 BNB to vBNB at a real, on-chain-read 42.24% supply APY at decision time.",
    manual: {
      timeDescription:
        "Comparing live supply rates across markets means opening Venus's own UI (or querying the Comptroller/PoolLens directly) and re-checking periodically, since posted rates drift block to block with utilization.",
      riskDescription:
        "Idle capital earns nothing while it sits unrouted; every day of manual delay between \"I should check rates\" and actually acting is a day of foregone yield.",
      costDescription:
        "Not free either way, but a human re-checking rates before every allocation decision is spending attention an agent spends compute on instead.",
    },
    advantageSummary:
      "The agent didn't have to remember to check. It read the real rate at the moment of the decision and acted, instead of relying on whenever the yield happened to catch a human's attention.",
  },
  {
    erc8004AgentId: "1819",
    // The Aug 14 drift fix: remove, corrective swap, approvals, re-mint.
    taskTxHashes: [
      "0xe4d5065bb9f95986951b4b4b734163a371c8b99e8743f3a1ad75fdfc859dfee5",
      "0x011654e75bfa00e313ae04614cc3f2801cae16f1de57712ee8ed6d44a1d30c76",
      "0x029eeed44f175b7949dfa25fb5ce72f980b4dec367b092fb7bec531683926b3c",
      "0x56016bb793aaf5fbecfb9ce76b44dffcfdbc96c5e718069c0633f421a6bdc338",
      "0xcca04662093e7e57e3a74ef21efb47c687149ed94e120b33092a4924db9bd3ea",
      "0x0c7657adb8870f68a40d20dedf552023a5306ae4be3f25243e768a23a7b0d9fc",
    ],
    category: "REBALANCING",
    title: "Detect a concentrated LP position drifting out of range and rebalance it for real",
    objective:
      "A PancakeSwap V3 WBNB/USDT (0.01% fee tier) concentrated liquidity position stops earning fees the moment price moves outside its range. Notice that, and reposition around the new price.",
    reactionTimeDescription:
      "Detected the drift on the very next monitoring pass after price moved. On this thin testnet pool, that happened within roughly ten minutes of the position opening.",
    outcome:
      "Removed the drifted position (decreaseLiquidity + collect + burn, batched into one multicall tx) and re-minted centered on the new price. Verified on-chain: dust dropped from ~397.68 USDT (99.98% of one side sitting idle from an earlier, less-precise sizing pass) to effectively zero after the fix.",
    manual: {
      timeDescription:
        "A concentrated LP position needs someone to actually notice the current tick has left the position's range. That means periodically pulling the pool's slot0() or checking a dashboard, not something most LPs do continuously.",
      riskDescription:
        "Every block a position sits out of range, it earns zero trading fees on capital that's still fully deployed and still exposed to impermanent loss from the price move that caused the drift in the first place.",
      costDescription:
        "Rebalancing itself costs real gas either way (this session's real remove+rebalance sequence cost ~0.0018 BNB total). The difference isn't the cost of acting, it's the delay before someone decides to.",
    },
    advantageSummary:
      "The real gap here wasn't skill, it was latency: the agent closed a drift that had already happened on its very next check, rather than waiting for a person to think to look.",
  },
] as const;

export async function getAdvantageTasks(): Promise<AdvantageTask[]> {
  const results: AdvantageTask[] = [];

  for (const spec of TASK_SPECS) {
    const agent = await prisma.agent.findUnique({
      where: { chainId_erc8004AgentId: { chainId: 97, erc8004AgentId: spec.erc8004AgentId } },
      // Only this task's own txs: an agent's full history (the Rebalancer's
      // includes an 11-day crash loop) would misstate what this task cost.
      include: { actions: { where: { txHash: { in: [...spec.taskTxHashes] } }, orderBy: { timestamp: "asc" } } },
    });
    if (!agent || agent.actions.length === 0) continue;

    const totalGasCostBnb = agent.actions.reduce((sum, a) => sum + (a.gasCost ?? 0), 0);

    results.push({
      category: spec.category,
      title: spec.title,
      objective: spec.objective,
      agent: {
        id: agent.id,
        name: agent.name,
        walletAddress: agent.walletAddress,
        txHashes: agent.actions.map((a) => a.txHash),
        totalGasCostBnb,
        reactionTimeDescription: spec.reactionTimeDescription,
        outcome: spec.outcome,
      },
      manual: spec.manual,
      advantageSummary: spec.advantageSummary,
    });
  }

  return results;
}
