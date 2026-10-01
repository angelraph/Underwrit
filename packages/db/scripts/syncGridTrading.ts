#!/usr/bin/env tsx
/**
 * Pull Grid Trading's real on-chain actions (BSC Testnet, PancakeSwap V3
 * WBNB/USDT 0.01% pool) into Postgres. Same pattern as the other three sync
 * scripts: every tx hash below is real, broadcast and confirmed, and gas
 * costs and block timestamps are read live from the chain, never estimated.
 *
 * Unlike the other three, Grid Trading's ERC-8004 identity was NOT minted
 * via `bag deploy verify` (the managed platform's 3-concurrent-agent
 * hosting cap was already full; see commit 22a7545). Instead it was
 * registered directly against the real IdentityRegistry contract from the
 * agent's own wallet (apps/agents/gridtrading/app/agent/src/registerIdentity.ts),
 * independently confirmed on BscScan Testnet. Tx
 * 0xc9550eca7d92f47277dfaeba94039e7fccb5fe0edf47f5a10574321438dd8e4c minted
 * BEP-721 "AgentIdentity" token ID 1839 to the agent's wallet.
 *
 * Re-running this script is idempotent. It skips any tx hash already
 * present in the Action table.
 */

import { createPublicClient, formatEther, http } from "viem";
import { bscTestnet } from "viem/chains";
import { markAbandonedApprovals } from "./lib/abandonedApprovals";
import { journalPathFor, reportCoverage, syncJournal } from "./lib/actionJournal";
import { recordArenaRun } from "./lib/arena";
import { readHoldings, startingBlock, valueInBnb } from "./lib/portfolio";
import { archiveClient, syncWalletHistory } from "./lib/walletHistory";
import { ActionResult, AgentSource, Category, Network, prisma, withDbRetry } from "@underwrit/db";
import { CATEGORY_BASELINES, computeCounterfactual, computeEvidenceSnapshot } from "@underwrit/evidence-engine";

const AGENT_WALLET = "0xE71bA547cA890B64A5207A0b50b66Dd3f5EE9e01";
const OWNER_WALLET = "0x9Ffe8BF12437D30dC0BB321EE9Ad76b488F664FB"; // human owner (angelraphael.bnb), same as the other three
const ERC8004_AGENT_ID = "1839"; // real BEP-721 tokenId, self-registered; see registerIdentity.ts and this file's header comment
const CHAIN_ID = 97; // BSC Testnet

const KNOWN_ACTIONS = [
  // Nonces 0 to 2, the agent's very first run on 2026-08-14. Real and
  // confirmed (re-checked 2026-10-01: sent from AGENT_WALLET, status
  // success), but left out of this list until then.
  {
    hash: "0x23b222fba54a9ad4819b196ba45a0efeffdb4386b24b784eeb2df01213cf69be",
    type: "wrap_native",
    params: { token: "WBNB", note: "first run: wrapped native BNB so the grid could hold a WBNB/USDT split" },
  },
  {
    hash: "0xda4afcd4ee4940241c3e4d6d3d0e8e355d164d0981d563a797c0f1e295cc113c",
    type: "approve",
    params: { protocol: "pancakeswap-v3", token: "WBNB", spender: "SmartRouter", purpose: "grid rebalance sell" },
  },
  {
    hash: "0x47cb9a9da4882792c756afdcd100f7144bc037f2a2e13c211222165775039550",
    type: "sell_wbnb",
    params: {
      protocol: "pancakeswap-v3",
      pool: "WBNB/USDT 0.01%",
      note: "first run: WBNB holdings sat above the level's target allocation, so sold WBNB into USDT",
    },
  },
  {
    hash: "0x5c5a19107f94ff84ae41933dba131bc20b6bb9cfd9ebbca2093a283d66b8be31",
    type: "approve",
    params: { protocol: "pancakeswap-v3", token: "WBNB", spender: "SmartRouter", purpose: "grid rebalance sell" },
  },
  {
    hash: "0x3fae5dfd6756e60db21ac395937d3b3c13cbca273795ede6bdcb4b64fd63f46a",
    type: "sell_wbnb",
    params: {
      protocol: "pancakeswap-v3",
      pool: "WBNB/USDT 0.01%",
      note:
        "2026-08-14 run. Tick above grid center called for less WBNB than actually " +
        "held (level 0.95, target 40% vs actual 47%), so the agent sold WBNB into " +
        "USDT to move back toward the level's target allocation.",
    },
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: bscTestnet,
    transport: http(process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
  });

  const agent = await prisma.agent.upsert({
    where: { chainId_erc8004AgentId: { chainId: CHAIN_ID, erc8004AgentId: ERC8004_AGENT_ID } },
    update: {},
    create: {
      erc8004AgentId: ERC8004_AGENT_ID,
      chainId: CHAIN_ID,
      network: Network.TESTNET,
      category: Category.GRID,
      name: "Grid Trading",
      ownerAddress: OWNER_WALLET,
      walletAddress: AGENT_WALLET,
      studioDeployed: false, // not AgentCore-hosted yet (platform slot still full); identity is real, hosting is pending
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
      `  synced ${a.type}, tx ${a.hash.slice(0, 10)}…, gas ${gasCostBnb.toFixed(6)} BNB, block ${receipt.blockNumber}`,
    );
  }

  await syncJournal(client, agent.id, journalPathFor("gridtrading"));
  await syncWalletHistory(agent.id, AGENT_WALLET, { full: process.argv.includes("--full"), renameTypes: { swap_wbnb_to_usdt: "sell_wbnb", swap_usdt_to_wbnb: "buy_wbnb" } });
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

  // Grid vs. doing nothing: the wallet's real holdings the block before its
  // first action, valued at today's pool price, against what it holds now
  // (gas already paid out of it). Checked by hand on 2026-10-01 that every
  // balance change since then is explained by the agent's own txs, so no
  // outside top-up inflates the result.
  const archive = archiveClient();
  const startBlock = await startingBlock(archive, agent.id);
  let vsHoldingPct: number | null = null;
  let performance: { baseline: number; actual: number; block: bigint } | null = null;
  if (startBlock != null) {
    const block = await archive.getBlockNumber();
    const [start, now] = await Promise.all([readHoldings(archive, AGENT_WALLET, startBlock), readHoldings(archive, AGENT_WALLET, block)]);
    performance = { baseline: valueInBnb(start, now.usdtPerBnb), actual: valueInBnb(now, now.usdtPerBnb), block };
    vsHoldingPct = ((performance.actual - performance.baseline) / performance.baseline) * 100;
    console.log(
      `  vs holding: started with ${valueInBnb(start, start.usdtPerBnb).toFixed(4)} BNB at block ${startBlock}, ` +
        `worth ${performance.baseline.toFixed(4)} BNB today untouched, holds ${performance.actual.toFixed(4)} BNB now (${vsHoldingPct.toFixed(1)}%)`,
    );
  }

  await prisma.evidenceSnapshot.create({
    data: {
      agentId: agent.id,
      confidenceScore: snapshot.confidenceScore,
      successRate: snapshot.successRate,
      avgCost: snapshot.avgCost,
      avgReactionTimeSec: snapshot.avgReactionTimeSec,
      netYieldPct: vsHoldingPct, // result vs. holding the starting position, in BNB terms, see above
      worstDrawdownPct: null,
      // Real initial funding independently confirmed on-chain when the agent
      // first traded (see commit 22a7545: "0.05 tBNB, independently confirmed
      // on-chain"), minus the fixed 0.01 BNB gas reserve gridTradingCore.ts
      // always keeps untouched. Same convention as the Rebalancer's
      // capitalTested. This reflects only that initial funding round, not
      // any later top-ups, since 0.05 is the only figure this project has an
      // independently-confirmed on-chain source for.
      capitalTested: 0.04,
      daysObserved: snapshot.daysObserved,
      actionsExecuted: snapshot.actionsExecuted,
      actionsSucceeded: snapshot.actionsSucceeded,
      actionsFailed: snapshot.actionsFailed,
    },
  });
  console.log(
    `\nEvidence snapshot: confidence=${snapshot.confidenceScore} successRate=${(snapshot.successRate * 100).toFixed(0)}% actions=${snapshot.actionsExecuted}`,
  );

  // One live counterfactual for the whole position, kept on the latest
  // action and replaced every sync, since the comparison moves with price.
  const latest = await prisma.action.findFirst({ where: { agentId: agent.id }, orderBy: { timestamp: "desc" } });
  if (performance && latest) {
    const cf = computeCounterfactual({
      baselineScenario: CATEGORY_BASELINES.GRID,
      baselineOutcome: performance.baseline,
      actualOutcome: performance.actual,
    });
    await prisma.$transaction([
      prisma.counterfactual.deleteMany({ where: { action: { agentId: agent.id } } }),
      prisma.counterfactual.create({ data: { actionId: latest.id, ...cf, unit: "BNB" } }),
    ]);
    console.log(`Counterfactual: "${cf.baselineScenario}", value created ${cf.valueCreated >= 0 ? "+" : ""}${cf.valueCreated.toFixed(4)} BNB`);
    await recordArenaRun(agent.id, Category.GRID, {
      baselineBnb: performance.baseline,
      actualBnb: performance.actual,
      block: performance.block,
      baseline: CATEGORY_BASELINES.GRID,
    });
  }

  await prisma.$disconnect();
}

withDbRetry(main, { label: "syncGridTrading" }).catch((e) => {
  console.error(e);
  process.exit(1);
});
