#!/usr/bin/env tsx
/**
 * Pull the Rebalancer's real on-chain actions (BSC Testnet, PancakeSwap V3
 * WBNB/USDT 0.01% pool) into Postgres. Same pattern as
 * syncHealthFactorGuardian.ts / syncYieldRouter.ts — every tx hash below is
 * real, broadcast and confirmed this session, and every gas cost / block
 * timestamp is read live from the chain, never estimated.
 *
 * This history is genuinely eventful, not staged: the agent opened its
 * first position with a naive 50/50 swap split, the swap's own price impact
 * on this thin pool left the mint centered on a stale pre-swap tick (real
 * on-chain evidence of that: 397679568 raw USDT — ~99.98% of the swapped
 * side — sat unused as dust), the sizing logic was then fixed (two-phase:
 * size against pre-swap price, re-read the pool for the actual post-swap
 * price, finalize the mint range and run one bounded corrective swap
 * against THAT), and on the very next run the position had already drifted
 * out of range on its own (this pool moves fast) and the agent removed +
 * re-minted for real, landing with near-zero dust. Re-running this script
 * is idempotent: it skips any tx hash already present in the Action table.
 */

import { createPublicClient, formatEther, http } from "viem";
import { bscTestnet } from "viem/chains";
import { ActionResult, AgentSource, Category, Network, prisma, withDbRetry } from "@underwrit/db";
import { computeEvidenceSnapshot } from "@underwrit/evidence-engine";

const AGENT_WALLET = "0x04E47e45A095E1edA69B0007d75aE55eE9320e75";
const OWNER_WALLET = "0x9Ffe8BF12437D30dC0BB321EE9Ad76b488F664FB"; // human owner (angelraphael.bnb)
const ERC8004_AGENT_ID = "1819"; // registered gaslessly via `bag deploy verify` this session, BSC Testnet identity registry
const CHAIN_ID = 97; // BSC Testnet

const KNOWN_ACTIONS = [
  {
    hash: "0x7566d2ff16e78a27725f82897a1a531e8d75700a8352ef85ff60e1b9b31c270c",
    type: "swap_bnb_to_usdt",
    params: { protocol: "pancakeswap-v3", pool: "WBNB/USDT 0.01%", amountIn: "0.065 BNB", note: "initial open — naive 50/50 split" },
  },
  {
    hash: "0xc9a5a0dc6949d6bfca8e5dd581875939d89f0f258df3bb222351addf12bb85d0",
    type: "mint_position",
    params: { protocol: "pancakeswap-v3", tokenId: "36829", tickLower: 187536, tickUpper: 188536, note: "swap's own price impact left this mint stale — ~397.68 of the swapped USDT went unused as dust" },
  },
  {
    hash: "0xe4d5065bb9f95986951b4b4b734163a371c8b99e8743f3a1ad75fdfc859dfee5",
    type: "remove_position",
    params: { protocol: "pancakeswap-v3", tokenId: "36829", reason: "price drifted outside [187536, 188536)", note: "decreaseLiquidity + collect + burn batched in one multicall tx" },
  },
  {
    hash: "0x011654e75bfa00e313ae04614cc3f2801cae16f1de57712ee8ed6d44a1d30c76",
    type: "approve",
    params: { token: "USDT", spender: "SmartRouter", amount: "20753040", purpose: "corrective rebalancing swap" },
  },
  {
    hash: "0x029eeed44f175b7949dfa25fb5ce72f980b4dec367b092fb7bec531683926b3c",
    type: "swap_usdt_to_wbnb",
    params: { protocol: "pancakeswap-v3", note: "corrective swap sized by the fixed two-phase logic against the fresh post-remove price" },
  },
  {
    hash: "0x56016bb793aaf5fbecfb9ce76b44dffcfdbc96c5e718069c0633f421a6bdc338",
    type: "approve",
    params: { token: "USDT", spender: "NonfungiblePositionManager", amount: "376926528", purpose: "re-mint" },
  },
  {
    hash: "0xcca04662093e7e57e3a74ef21efb47c687149ed94e120b33092a4924db9bd3ea",
    type: "approve",
    params: { token: "WBNB", spender: "NonfungiblePositionManager", amount: "68748635468726357", purpose: "re-mint" },
  },
  {
    hash: "0x0c7657adb8870f68a40d20dedf552023a5306ae4be3f25243e768a23a7b0d9fc",
    type: "mint_position",
    params: { protocol: "pancakeswap-v3", tokenId: "36830", tickLower: 189604, tickUpper: 190604, note: "re-mint with corrected sizing — dust dropped to ~0 USDT / ~0.00076 WBNB" },
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
      category: Category.REBALANCING,
      name: "Rebalancer",
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
    console.log(`  synced ${a.type} — tx ${a.hash.slice(0, 10)}… gas ${gasCostBnb.toFixed(6)} BNB, block ${receipt.blockNumber}`);
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
      netYieldPct: null, // real trading-fee accrual needs an observation window we haven't had yet — not invented
      worstDrawdownPct: null,
      // Real BNB principal wrapped and deployed into the position (0.15
      // funded - 0.02 gas reserve).
      capitalTested: 0.13,
      daysObserved: snapshot.daysObserved,
      actionsExecuted: snapshot.actionsExecuted,
      actionsSucceeded: snapshot.actionsSucceeded,
      actionsFailed: snapshot.actionsFailed,
    },
  });
  console.log(`\nEvidence snapshot: confidence=${snapshot.confidenceScore} successRate=${(snapshot.successRate * 100).toFixed(0)}% actions=${snapshot.actionsExecuted}`);

  // No Counterfactual row yet, deliberately: CATEGORY_BASELINES.REBALANCING
  // ("held initial LP range unmanaged") is real and well-defined, but a
  // trustworthy dollar value-created figure needs an actual observed
  // fee-accrual window (in-range earning vs. the drifted position's zero
  // fee-earning) that we haven't held long enough to measure yet. The UI
  // already shows an honest "not yet available" state for this rather than
  // a fabricated number — see apps/web/app/agents/[id]/page.tsx.

  await prisma.$disconnect();
}

withDbRetry(main, { label: "syncRebalancer" }).catch((e) => {
  console.error(e);
  process.exit(1);
});
