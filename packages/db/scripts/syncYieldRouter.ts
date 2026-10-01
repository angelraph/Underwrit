#!/usr/bin/env tsx
/**
 * Pull the Yield Router's real on-chain actions (BSC Testnet) into Postgres.
 * Same pattern as syncHealthFactorGuardian.ts, every tx hash below is real,
 * broadcast and confirmed this session by yieldRouterCore.ts's real
 * Venus-supply-APY comparison and routing decision.
 */

import { createPublicClient, formatEther, http, parseAbi } from "viem";
import { VENUS_TESTNET } from "@underwrit/chain";
import { bscTestnet } from "viem/chains";
import { markAbandonedApprovals } from "./lib/abandonedApprovals";
import { journalPathFor, reportCoverage, syncJournal } from "./lib/actionJournal";
import { recordArenaRun } from "./lib/arena";
import { syncWalletHistory } from "./lib/walletHistory";
import {
  ActionResult,
  AgentSource,
  Category,
  Network,
  prisma,
  withDbRetry,
} from "@underwrit/db";
import { CATEGORY_BASELINES, computeCounterfactual, computeEvidenceSnapshot } from "@underwrit/evidence-engine";

const vBnbAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function exchangeRateCurrent() returns (uint256)",
]);

const AGENT_WALLET = "0x2406b7d0Dbc0a501e39EbE9606Ae7a9bE258321e";
const OWNER_WALLET = "0x9Ffe8BF12437D30dC0BB321EE9Ad76b488F664FB"; // human owner (angelraphael.bnb)
const ERC8004_AGENT_ID = "1818"; // registered gaslessly via `bag deploy verify` this session
const CHAIN_ID = 97; // BSC Testnet

const KNOWN_ACTIONS = [
  {
    hash: "0x51c0774de1bcf5dae1b2b844f70b55153632c0abbd8ac542230982a74a5fdd12",
    type: "supply_bnb",
    params: {
      protocol: "venus",
      market: "vBNB",
      asset: "BNB",
      amount: "0.15",
      reason: "vBNB real supply APY (42.24%) beat vUSDT (0%) at decision time",
    },
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: bscTestnet,
    transport: http(
      process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    ),
  });

  const agent = await prisma.agent.upsert({
    where: { chainId_erc8004AgentId: { chainId: CHAIN_ID, erc8004AgentId: ERC8004_AGENT_ID } },
    update: {},
    create: {
      erc8004AgentId: ERC8004_AGENT_ID,
      chainId: CHAIN_ID,
      network: Network.TESTNET,
      category: Category.YIELD,
      name: "Yield Router",
      ownerAddress: OWNER_WALLET,
      walletAddress: AGENT_WALLET,
      studioDeployed: true,
      source: AgentSource.OURS,
    },
  });
  console.log(`Agent: ${agent.id} (ERC-8004 #${ERC8004_AGENT_ID}, BSC Testnet)`);

  for (const a of KNOWN_ACTIONS) {
    const existing = await prisma.action.findFirst({ where: { txHash: a.hash } });
    if (existing) {
      console.log(`  skip ${a.type} (${a.hash.slice(0, 10)}…), already synced`);
      continue;
    }

    const receipt = await client.getTransactionReceipt({ hash: a.hash as `0x${string}` });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const gasCostBnb = Number(formatEther(receipt.gasUsed * receipt.effectiveGasPrice));

    await prisma.action.create({
      data: {
        agentId: agent.id,
        timestamp: new Date(Number(block.timestamp) * 1000),
        actionType: a.type,
        txHash: a.hash,
        paramsJson: a.params,
        gasCost: gasCostBnb,
        result: receipt.status === "success" ? ActionResult.SUCCESS : ActionResult.FAIL,
      },
    });
    console.log(
      `  synced ${a.type}, tx ${a.hash.slice(0, 10)}… gas ${gasCostBnb.toFixed(6)} BNB, block ${receipt.blockNumber}`,
    );
  }

  await syncJournal(client, agent.id, journalPathFor("yieldrouter"));
  await syncWalletHistory(agent.id, AGENT_WALLET, { full: process.argv.includes("--full") });
  await markAbandonedApprovals(agent.id);
  await reportCoverage(client, agent.id, AGENT_WALLET);

  const actions = await prisma.action.findMany({ where: { agentId: agent.id } });
  const snapshot = computeEvidenceSnapshot(
    actions.map((a) => ({
      timestamp: a.timestamp,
      result: a.result,
      gasCost: a.gasCost,
      latencyMs: a.latencyMs,
      paramsJson: a.paramsJson as Record<string, unknown>,
    })),
    { network: "TESTNET" },
  );

  // What the agent has actually earned, not the APY quoted when it acted:
  // every BNB it supplied (read from each supply tx's own value) against
  // what its vBNB is redeemable for right now (exchangeRateCurrent,
  // simulated so interest accrues up to this block). Annualized as simple
  // interest over each deposit's own time in the market.
  const supplies = await prisma.action.findMany({ where: { agentId: agent.id, actionType: "supply_bnb", result: "SUCCESS" } });
  let earned: { supplied: number; worth: number; annualizedPct: number; block: bigint } | null = null;
  if (supplies.length > 0) {
    const now = Date.now();
    let supplied = 0;
    let bnbDays = 0;
    for (const s of supplies) {
      const tx = await client.getTransaction({ hash: s.txHash as `0x${string}` });
      const amount = Number(formatEther(tx.value));
      supplied += amount;
      bnbDays += amount * ((now - s.timestamp.getTime()) / 86_400_000);
    }
    const block = await client.getBlockNumber();
    const [vBnbBalance, rate] = await Promise.all([
      client.readContract({ address: VENUS_TESTNET.vBNB, abi: vBnbAbi, functionName: "balanceOf", args: [AGENT_WALLET], blockNumber: block }),
      client.simulateContract({ address: VENUS_TESTNET.vBNB, abi: vBnbAbi, functionName: "exchangeRateCurrent", account: AGENT_WALLET, blockNumber: block }),
    ]);
    const worth = Number(formatEther((vBnbBalance * rate.result) / 10n ** 18n));
    earned = { supplied, worth, annualizedPct: bnbDays > 0 ? ((worth - supplied) / bnbDays) * 365 * 100 : 0, block };
    console.log(
      `  earned: supplied ${supplied} BNB, redeemable for ${worth.toFixed(6)} BNB now (+${(worth - supplied).toFixed(6)}), ${earned.annualizedPct.toFixed(1)}% annualized`,
    );
  }

  await prisma.evidenceSnapshot.create({
    data: {
      agentId: agent.id,
      confidenceScore: snapshot.confidenceScore,
      successRate: snapshot.successRate,
      avgCost: snapshot.avgCost,
      avgReactionTimeSec: snapshot.avgReactionTimeSec,
      // Realized, annualized: see "earned" above.
      netYieldPct: earned?.annualizedPct ?? null,
      worstDrawdownPct: null,
      capitalTested: 0.15,
      daysObserved: snapshot.daysObserved,
      actionsExecuted: snapshot.actionsExecuted,
      actionsSucceeded: snapshot.actionsSucceeded,
      actionsFailed: snapshot.actionsFailed,
    },
  });
  console.log(
    `\nEvidence snapshot: confidence=${snapshot.confidenceScore} successRate=${(snapshot.successRate * 100).toFixed(0)}% actions=${snapshot.actionsExecuted}`,
  );

  // Counterfactual: the same BNB left idle earns nothing, so the baseline
  // is simply what was supplied. Replaced every sync, since the actual side
  // keeps accruing.
  const latestSupply = supplies.at(-1);
  if (earned && latestSupply) {
    const cf = computeCounterfactual({
      baselineScenario: CATEGORY_BASELINES.YIELD,
      baselineOutcome: earned.supplied,
      actualOutcome: earned.worth,
    });
    await prisma.$transaction([
      prisma.counterfactual.deleteMany({ where: { action: { agentId: agent.id } } }),
      prisma.counterfactual.create({ data: { actionId: latestSupply.id, ...cf, unit: "BNB" } }),
    ]);
    console.log(`Counterfactual: "${cf.baselineScenario}", value created +${cf.valueCreated.toFixed(6)} BNB`);
    await recordArenaRun(agent.id, Category.YIELD, {
      baselineBnb: earned.supplied,
      actualBnb: earned.worth,
      block: earned.block,
      baseline: CATEGORY_BASELINES.YIELD,
    });
  }

  await prisma.$disconnect();
}

withDbRetry(main, { label: "syncYieldRouter" }).catch((e) => {
  console.error(e);
  process.exit(1);
});
