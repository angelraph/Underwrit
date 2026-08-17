#!/usr/bin/env tsx
/**
 * Pull the Health Factor Guardian's real on-chain actions (BSC Testnet) into
 * Postgres, so Underwrit's UI can show genuine evidence for this agent
 * instead of the MOCK_AGENTS placeholder data.
 *
 * Every tx hash below is real — broadcast and confirmed during this
 * session's build (seedPosition.ts + monitor.ts runs against the agent's
 * live Venus Protocol testnet position). Re-running this script is
 * idempotent: it skips any tx hash already present in the Action table.
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
import {
  CATEGORY_BASELINES,
  computeCounterfactual,
  computeEvidenceSnapshot,
} from "@underwrit/evidence-engine";

const AGENT_WALLET = "0xd2368DBE3ab9232111250C72358ffC1e60A75Fb2";
const OWNER_WALLET = "0x9Ffe8BF12437D30dC0BB321EE9Ad76b488F664FB"; // human owner (angelraphael.bnb), from hackathon registration
const ERC8004_AGENT_ID = "1814"; // registered gaslessly via `bag deploy verify` this session
const CHAIN_ID = 97; // BSC Testnet

const KNOWN_ACTIONS = [
  {
    hash: "0x96f651f8c999fb9e8747c8d4e1803f828a96983c07cde65a6a05ac613a2e8909",
    type: "supply_collateral",
    params: { protocol: "venus", market: "vBNB", asset: "BNB", amount: "0.05" },
  },
  {
    hash: "0xa3059de4400e9d6ceab52ecabcc97982754166f6e93b5de56f3aa040397e80df",
    type: "enable_collateral",
    params: { protocol: "venus", market: "vBNB" },
  },
  {
    hash: "0x9f8e2fb5c65be6139c531a0dafa86b6f460fbc3ac38cbed6c7deab62b81e282b",
    type: "borrow",
    params: { protocol: "venus", market: "vUSDT", asset: "USDT", amount: "1" },
  },
  {
    hash: "0x55ec8a77a786d9ada43b73fff851207d9f8f5f69ab181b9235c844c9a91e4245",
    type: "approve_repay",
    params: { protocol: "venus", asset: "USDT", amount: "0.5", forRepay: true },
  },
  {
    hash: "0x7ccd9773af98867262b94ba5d16b0306d47d307d6bf2e7f259fd8795ef374ad3",
    type: "repay",
    params: {
      protocol: "venus",
      market: "vUSDT",
      asset: "USDT",
      amount: "0.5",
      trigger: "AT_RISK (safety-buffer threshold forced high for this demo run)",
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
      category: Category.HEALTH_FACTOR,
      name: "Health Factor Guardian",
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
      netYieldPct: null,
      worstDrawdownPct: null,
      // Venus's own price oracle reported ~$24 of borrowing capacity against
      // the 0.05 BNB collateral supplied (see seedPosition.ts console output,
      // Comptroller.getAccountLiquidity) — an on-chain-sourced figure, not an
      // estimate we invented.
      capitalTested: 24,
      daysObserved: snapshot.daysObserved,
      actionsExecuted: snapshot.actionsExecuted,
      actionsSucceeded: snapshot.actionsSucceeded,
      actionsFailed: snapshot.actionsFailed,
    },
  });
  console.log(
    `\nEvidence snapshot: confidence=${snapshot.confidenceScore} successRate=${(snapshot.successRate * 100).toFixed(0)}% actions=${snapshot.actionsExecuted}`,
  );

  // Counterfactual for the repay: liquidity observed before vs. after the
  // guardian's real repay tx (both figures read live from monitor.ts runs
  // this session — see project memory for the exact readings).
  const repayAction = await prisma.action.findFirst({
    where: { agentId: agent.id, actionType: "repay" },
  });
  if (repayAction) {
    const cf = computeCounterfactual({
      baselineScenario: CATEGORY_BASELINES.HEALTH_FACTOR,
      baselineOutcome: 23.4999,
      actualOutcome: 23.7499,
    });
    const existingCf = await prisma.counterfactual.findUnique({
      where: { actionId: repayAction.id },
    });
    if (!existingCf) {
      await prisma.counterfactual.create({ data: { actionId: repayAction.id, ...cf } });
      console.log(
        `Counterfactual: "${cf.baselineScenario}" → value created ${cf.valueCreated.toFixed(4)} USD liquidity`,
      );
    }
  }

  await prisma.$disconnect();
}

withDbRetry(main, { label: "syncHealthFactorGuardian" }).catch((e) => {
  console.error(e);
  process.exit(1);
});
