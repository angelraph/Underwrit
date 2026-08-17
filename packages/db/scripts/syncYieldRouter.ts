#!/usr/bin/env tsx
/**
 * Pull the Yield Router's real on-chain actions (BSC Testnet) into Postgres.
 * Same pattern as syncHealthFactorGuardian.ts — every tx hash below is real,
 * broadcast and confirmed this session by yieldRouterCore.ts's real
 * Venus-supply-APY comparison and routing decision.
 */

import { createPublicClient, formatEther, http } from "viem";
import { bscTestnet } from "viem/chains";
import {
  ActionResult,
  AgentSource,
  Category,
  Network,
  prisma,
  withDbRetry,
} from "@underwrit/db";
import { CATEGORY_BASELINES, computeCounterfactual, computeEvidenceSnapshot } from "@underwrit/evidence-engine";

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
      console.log(`  skip ${a.type} (${a.hash.slice(0, 10)}…) — already synced`);
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
      `  synced ${a.type} — tx ${a.hash.slice(0, 10)}… gas ${gasCostBnb.toFixed(6)} BNB, block ${receipt.blockNumber}`,
    );
  }

  const actions = await prisma.action.findMany({ where: { agentId: agent.id } });
  const snapshot = computeEvidenceSnapshot(
    actions.map((a) => ({
      timestamp: a.timestamp,
      result: a.result,
      gasCost: a.gasCost,
      latencyMs: null,
      paramsJson: a.paramsJson as Record<string, unknown>,
    })),
    { network: "TESTNET" },
  );

  await prisma.evidenceSnapshot.create({
    data: {
      agentId: agent.id,
      confidenceScore: snapshot.confidenceScore,
      successRate: snapshot.successRate,
      avgCost: snapshot.avgCost,
      avgReactionTimeSec: snapshot.avgReactionTimeSec,
      // Real supply APY read live from Venus at decision time (see venus.ts
      // getSupplyApyPct — annualized from an actually-measured block time).
      netYieldPct: 42.24,
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

  // Counterfactual: idle capital earns 0% by definition — a real, honest
  // baseline that needs no invented comparison data (see CATEGORY_BASELINES.YIELD's
  // own note on why the original "highest-TVL pool" baseline wasn't
  // something this project could compute). Actual = the real supply APY
  // read live from Venus at decision time (same 42.24% recorded on the
  // EvidenceSnapshot above).
  const supplyAction = await prisma.action.findFirst({
    where: { agentId: agent.id, actionType: "supply_bnb" },
  });
  if (supplyAction) {
    const existingCf = await prisma.counterfactual.findUnique({ where: { actionId: supplyAction.id } });
    if (!existingCf) {
      const cf = computeCounterfactual({
        baselineScenario: CATEGORY_BASELINES.YIELD,
        baselineOutcome: 0,
        actualOutcome: 42.24,
      });
      await prisma.counterfactual.create({
        data: { actionId: supplyAction.id, ...cf, unit: "% APY" },
      });
      console.log(`Counterfactual: "${cf.baselineScenario}" → value created +${cf.valueCreated.toFixed(2)}% APY`);
    }
  }

  await prisma.$disconnect();
}

withDbRetry(main, { label: "syncYieldRouter" }).catch((e) => {
  console.error(e);
  process.exit(1);
});
