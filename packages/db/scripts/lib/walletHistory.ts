/**
 * Finds every transaction an agent's wallet has ever sent, using only free
 * public RPCs, and records the ones not already in the Action table.
 *
 * How: a wallet's nonce only goes up, one per sent tx. Reading the nonce at
 * past blocks (which needs an archive node; the NodeReal and thirdweb
 * public endpoints below serve that for free) lets us bisect the block
 * range down to exactly the blocks where the nonce moved, then read those
 * blocks' transactions. Cost scales with how many blocks hold the agent's
 * txs, not with chain length, and failed txs are found too (a log-based
 * search would miss those, since a reverted tx emits no logs).
 *
 * This replaces the need for a paid explorer API: Etherscan's free tier
 * excludes BSC Testnet and BscScan's pages are bot-gated.
 */

import { createPublicClient, fallback, formatEther, getAddress, http, type Hash, type PublicClient, type Transaction } from "viem";
import { bscTestnet } from "viem/chains";
import { ERC8004_ADDRESSES, BSC_TESTNET_CHAIN_ID } from "@underwrit/chain";
import { ActionResult, prisma } from "@underwrit/db";
import { labelTransaction } from "./actionJournal";

const ARCHIVE_RPCS = (
  process.env.BSC_TESTNET_ARCHIVE_RPC_URLS ??
  // Both free and keyless for callers. The NodeReal URL is the public
  // endpoint BNB Chain's own docs list for BSC Testnet.
  "https://bsc-testnet.nodereal.io/v1/e9a36765eb8a40b9bd12e680a1fd2bc5,https://97.rpc.thirdweb.com"
).split(",");

export function archiveClient(): PublicClient {
  return createPublicClient({
    chain: bscTestnet,
    transport: fallback(ARCHIVE_RPCS.map((url) => http(url.trim(), { timeout: 30_000, retryCount: 4, retryDelay: 1_500 }))),
  }) as PublicClient;
}

/** Block numbers in [from, to] where the wallet sent at least one tx. */
async function blocksWithSends(client: PublicClient, wallet: `0x${string}`, from: bigint, to: bigint): Promise<bigint[]> {
  const nonceAt = (block: bigint) => client.getTransactionCount({ address: wallet, blockNumber: block });
  const found: bigint[] = [];

  // Invariant: nonce at the end of `lo` is nLo, at the end of `hi` is nHi,
  // and any sends in between happened in blocks lo+1..hi.
  async function search(lo: bigint, hi: bigint, nLo: number, nHi: number): Promise<void> {
    if (nLo === nHi) return;
    if (hi - lo === 1n) {
      found.push(hi);
      return;
    }
    const mid = (lo + hi) / 2n;
    const nMid = await nonceAt(mid);
    await search(lo, mid, nLo, nMid);
    await search(mid, hi, nMid, nHi);
  }

  const start = from > 0n ? from - 1n : 0n;
  await search(start, to, from > 0n ? await nonceAt(start) : 0, await nonceAt(to));
  return found;
}

export interface WalletTx {
  tx: Transaction;
  /** Agent decisions get recorded; setup like identity registration or moving funds out does not. */
  kind: "action" | "registration" | "transfer";
}

export async function findWalletTxs(client: PublicClient, wallet: `0x${string}`, from: bigint, to: bigint): Promise<WalletTx[]> {
  const blocks = await blocksWithSends(client, wallet, from, to);
  const registry = getAddress(ERC8004_ADDRESSES[BSC_TESTNET_CHAIN_ID].identityRegistry);
  const out: WalletTx[] = [];
  for (const blockNumber of blocks) {
    const block = await client.getBlock({ blockNumber, includeTransactions: true });
    for (const tx of block.transactions) {
      if (getAddress(tx.from) !== getAddress(wallet)) continue;
      const kind =
        tx.to && getAddress(tx.to) === registry ? "registration" : tx.input === "0x" ? "transfer" : "action";
      out.push({ tx: tx as Transaction, kind });
    }
  }
  return out.sort((a, b) => a.tx.nonce - b.tx.nonce);
}

/**
 * Records every agent action the wallet sent that isn't in the Action table
 * yet. With `full`, scans from genesis; otherwise only from the block of
 * the newest recorded action, which keeps the regular 6-hourly sync cheap.
 */
export async function syncWalletHistory(
  agentId: string,
  wallet: `0x${string}`,
  opts: { full?: boolean; renameTypes?: Record<string, string> } = {},
): Promise<void> {
  const client = archiveClient();
  const head = await client.getBlockNumber();

  let from = 0n;
  if (!opts.full) {
    const latest = await prisma.action.findFirst({ where: { agentId }, orderBy: { timestamp: "desc" } });
    if (latest) from = (await client.getTransactionReceipt({ hash: latest.txHash as Hash })).blockNumber;
  }

  const txs = await findWalletTxs(client, wallet, from, head);
  let added = 0;
  for (const { tx, kind } of txs) {
    if (kind !== "action") {
      console.log(`  history: nonce ${tx.nonce} is a ${kind} (${tx.hash.slice(0, 10)}…), not an agent action`);
      continue;
    }
    if (await prisma.action.findFirst({ where: { txHash: tx.hash } })) continue;

    const receipt = await client.getTransactionReceipt({ hash: tx.hash });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const gasCostBnb = Number(formatEther(receipt.gasUsed * receipt.effectiveGasPrice));
    const labelled = labelTransaction(tx, "contract_call");
    const type = opts.renameTypes?.[labelled.type] ?? labelled.type;

    await prisma.action.create({
      data: {
        agentId,
        timestamp: new Date(Number(block.timestamp) * 1000),
        actionType: type,
        txHash: tx.hash,
        paramsJson: { ...labelled.params, source: "recovered from wallet history", nonce: tx.nonce },
        gasCost: gasCostBnb,
        result: receipt.status === "success" ? ActionResult.SUCCESS : ActionResult.FAIL,
      },
    });
    added++;
    console.log(`  history: recorded nonce ${tx.nonce} ${type}${receipt.status === "success" ? "" : " (FAILED on-chain)"}, tx ${tx.hash.slice(0, 10)}…`);
  }
  console.log(`  history: scanned blocks ${from}..${head}, ${txs.length} sent txs found, ${added} newly recorded`);
}
