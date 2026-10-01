/**
 * Shared by the four sync scripts: reads an agent's action journal (written
 * by its own monitor.ts every time it broadcasts something) and turns every
 * tx in it into an Action row.
 *
 * Before this existed, every sync script carried a hand-written list of tx
 * hashes, so anything an agent did on its own between edits never reached
 * the database. That is exactly how the Rebalancer's Aug 17 to Sep 10
 * history went unrecorded. The journal closes that gap for every run from
 * now on. It does not recover the old gap: that needs an explorer API
 * (Etherscan's free tier excludes BSC Testnet, and the public RPCs here
 * serve neither eth_getLogs nor historical state).
 *
 * Nothing in the journal is trusted as-is. Each hash is fetched from the
 * chain, its label comes from the calldata it actually carried (which
 * contract, which function, which token went in), and its gas cost and
 * timestamp come from the receipt and block.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeFunctionData, formatEther, getAddress, parseAbi, type Hash, type PublicClient, type Transaction } from "viem";
import { PANCAKESWAP_V3_TESTNET, VENUS_TESTNET, VENUS_USDT_TESTNET } from "@underwrit/chain";
import { ActionResult, prisma } from "@underwrit/db";

/** One line of `action-journal.jsonl`, as written by each agent's src/actionJournal.ts. */
export interface JournalEntry {
  /** The agent's own name for what it did, e.g. "rebalance_position". */
  action: string;
  /** When the agent read the chain state that made it act (ISO string). */
  detectedAt: string;
  /** Every tx the action broadcast, in order. `type` is set only when the agent already knows it exactly. */
  legs: { hash: string; type?: string }[];
  params?: Record<string, unknown>;
}

/** Where an agent's monitor.ts writes its journal, e.g. journalPathFor("rebalancer"). */
export function journalPathFor(agentDir: string): string {
  return resolve(__dirname, "../../../../apps/agents", agentDir, "app/agent/action-journal.jsonl");
}

export function readJournal(path: string): JournalEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      try {
        return JSON.parse(line) as JournalEntry;
      } catch {
        throw new Error(`${path}: line ${i + 1} is not valid JSON`);
      }
    });
}

const decodeAbi = parseAbi([
  "function approve(address spender, uint256 amount)",
  "function deposit()",
  "function multicall(uint256 deadline, bytes[] data)",
  "function multicall(bytes[] data)",
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params)",
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params)",
  "function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params)",
  // Classic Uniswap V3 SwapRouter shape (with a deadline field). SmartRouter
  // doesn't accept it; the Rebalancer's very first tx used it and reverted.
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params)",
  "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params)",
  "function repayBorrow(uint256 repayAmount)",
  "function borrow(uint256 borrowAmount)",
  "function enterMarkets(address[] vTokens)",
  "function mint()",
]);

const TOKEN_SYMBOLS: Record<string, string> = {
  [getAddress(PANCAKESWAP_V3_TESTNET.WBNB)]: "WBNB",
  [getAddress(VENUS_USDT_TESTNET)]: "USDT",
};

const symbolOf = (addr: string) => TOKEN_SYMBOLS[getAddress(addr)] ?? addr;
const same = (a: string | null | undefined, b: string) => a != null && getAddress(a) === getAddress(b);

/**
 * Names a tx by what its calldata did on-chain. Falls back to the agent's
 * own action name only for calls this table doesn't recognise, so an
 * unexpected call still lands in the log instead of being dropped.
 */
export function labelTransaction(tx: Pick<Transaction, "to" | "input">, fallback: string): { type: string; params: Record<string, unknown> } {
  let decoded;
  try {
    decoded = decodeFunctionData({ abi: decodeAbi, data: tx.input });
  } catch {
    return { type: fallback, params: {} };
  }

  if (decoded.functionName === "approve") {
    const [spender, amount] = decoded.args as readonly [string, bigint];
    const spenderName = same(spender, PANCAKESWAP_V3_TESTNET.smartRouter)
      ? "SmartRouter"
      : same(spender, PANCAKESWAP_V3_TESTNET.nonfungiblePositionManager)
        ? "NonfungiblePositionManager"
        : same(spender, VENUS_TESTNET.vUSDT)
          ? "vUSDT"
          : spender;
    return { type: "approve", params: { token: symbolOf(tx.to ?? ""), spender: spenderName, amount: amount.toString() } };
  }

  if (decoded.functionName === "deposit" && same(tx.to, PANCAKESWAP_V3_TESTNET.WBNB)) {
    return { type: "wrap_native", params: { token: "WBNB" } };
  }

  if (same(tx.to, PANCAKESWAP_V3_TESTNET.smartRouter) && decoded.functionName === "exactInputSingle") {
    const p = (decoded.args as readonly [{ tokenIn: string; tokenOut: string; amountIn: bigint }])[0];
    return {
      type: `swap_${symbolOf(p.tokenIn).toLowerCase()}_to_${symbolOf(p.tokenOut).toLowerCase()}`,
      params: { protocol: "pancakeswap-v3", tokenIn: symbolOf(p.tokenIn), tokenOut: symbolOf(p.tokenOut), amountIn: p.amountIn.toString(), calledDirectly: true },
    };
  }

  if (same(tx.to, PANCAKESWAP_V3_TESTNET.smartRouter) && decoded.functionName === "multicall") {
    const inner = (decoded.args as readonly unknown[]).at(-1) as readonly `0x${string}`[];
    for (const call of inner) {
      try {
        const swap = decodeFunctionData({ abi: decodeAbi, data: call });
        if (swap.functionName !== "exactInputSingle") continue;
        const p = (swap.args as readonly [{ tokenIn: string; tokenOut: string; amountIn: bigint; fee: number }])[0];
        const tokenIn = symbolOf(p.tokenIn);
        const tokenOut = symbolOf(p.tokenOut);
        return {
          // Grid Trading names its swaps buy_wbnb / sell_wbnb; keep that wording when the agent supplied it.
          type: /^(buy|sell)_/.test(fallback) ? fallback : `swap_${tokenIn.toLowerCase()}_to_${tokenOut.toLowerCase()}`,
          params: { protocol: "pancakeswap-v3", tokenIn, tokenOut, amountIn: p.amountIn.toString(), fee: p.fee },
        };
      } catch {
        // not a call this table knows; keep looking
      }
    }
    return { type: "swap", params: { protocol: "pancakeswap-v3" } };
  }

  if (same(tx.to, PANCAKESWAP_V3_TESTNET.nonfungiblePositionManager)) {
    // A position call can arrive bare or wrapped in a multicall (mint +
    // refundETH, or decreaseLiquidity + collect + burn), so look inside.
    const calls =
      decoded.functionName === "multicall"
        ? ((decoded.args as readonly unknown[]).at(-1) as readonly `0x${string}`[]).flatMap((data) => {
            try {
              return [decodeFunctionData({ abi: decodeAbi, data })];
            } catch {
              return [];
            }
          })
        : [decoded];
    for (const call of calls) {
      if (call.functionName === "mint" && call.args?.length === 1) {
        const p = (call.args as readonly [{ tickLower: number; tickUpper: number }])[0];
        return { type: "mint_position", params: { protocol: "pancakeswap-v3", tickLower: p.tickLower, tickUpper: p.tickUpper } };
      }
      if (call.functionName === "increaseLiquidity") {
        const p = (call.args as readonly [{ tokenId: bigint }])[0];
        return { type: "deploy_idle_dust", params: { protocol: "pancakeswap-v3", tokenId: p.tokenId.toString() } };
      }
      if (call.functionName === "decreaseLiquidity") {
        const p = (call.args as readonly [{ tokenId: bigint }])[0];
        return { type: "remove_position", params: { protocol: "pancakeswap-v3", tokenId: p.tokenId.toString() } };
      }
    }
  }

  if (same(tx.to, VENUS_TESTNET.vUSDT) && decoded.functionName === "repayBorrow") {
    return { type: "repay", params: { protocol: "venus", market: "vUSDT", amount: (decoded.args as readonly [bigint])[0].toString() } };
  }

  if (same(tx.to, VENUS_TESTNET.vUSDT) && decoded.functionName === "borrow") {
    return { type: "borrow", params: { protocol: "venus", market: "vUSDT", amount: (decoded.args as readonly [bigint])[0].toString() } };
  }

  if (same(tx.to, VENUS_TESTNET.comptroller) && decoded.functionName === "enterMarkets") {
    return { type: "enable_collateral", params: { protocol: "venus", markets: (decoded.args as readonly [readonly string[]])[0] } };
  }

  if (same(tx.to, VENUS_TESTNET.vBNB) && decoded.functionName === "mint") {
    return { type: "supply_bnb", params: { protocol: "venus", market: "vBNB" } };
  }

  return { type: fallback, params: {} };
}

/**
 * Inserts every not-yet-recorded tx from the journal. The last leg of each
 * action also gets `latencyMs`: the time from the agent reading the state
 * that triggered it to its final tx landing in a block. That is the time
 * the agent itself took to respond. It does not include the gap between
 * the condition first appearing on-chain and the next scheduled check.
 */
export async function syncJournal(client: PublicClient, agentId: string, journalPath: string): Promise<void> {
  const entries = readJournal(journalPath);
  if (entries.length === 0) {
    console.log(`  journal: nothing recorded yet (${journalPath})`);
    return;
  }

  for (const entry of entries) {
    const detectedAt = new Date(entry.detectedAt);
    for (const [i, leg] of entry.legs.entries()) {
      const hash = leg.hash as Hash;
      if (await prisma.action.findFirst({ where: { txHash: hash } })) {
        console.log(`  skip ${hash.slice(0, 10)}… (${entry.action}), already synced`);
        continue;
      }

      const [tx, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      const landedAt = new Date(Number(block.timestamp) * 1000);
      const gasCostBnb = Number(formatEther(receipt.gasUsed * receipt.effectiveGasPrice));
      const labelled = labelTransaction(tx, entry.action);
      const isLastLeg = i === entry.legs.length - 1;
      const latencyMs = isLastLeg && !Number.isNaN(detectedAt.getTime()) ? Math.max(0, landedAt.getTime() - detectedAt.getTime()) : null;

      await prisma.action.create({
        data: {
          agentId,
          timestamp: landedAt,
          actionType: leg.type ?? labelled.type,
          txHash: hash,
          paramsJson: { ...entry.params, ...labelled.params, partOf: entry.action, leg: `${i + 1} of ${entry.legs.length}` },
          gasCost: gasCostBnb,
          result: receipt.status === "success" ? ActionResult.SUCCESS : ActionResult.FAIL,
          latencyMs,
        },
      });
      console.log(
        `  synced ${leg.type ?? labelled.type} (${entry.action}), tx ${hash.slice(0, 10)}… gas ${gasCostBnb.toFixed(6)} BNB` +
          (latencyMs != null ? `, ${(latencyMs / 1000).toFixed(1)}s from detection to confirmation` : ""),
      );
    }
  }
}

/**
 * Prints how many txs the wallet has sent in total against how many are in
 * the Action table, so any history the database is missing shows up in
 * every monitor log instead of going unnoticed.
 */
export async function reportCoverage(client: PublicClient, agentId: string, wallet: `0x${string}`): Promise<void> {
  const [sent, recorded] = await Promise.all([client.getTransactionCount({ address: wallet }), prisma.action.count({ where: { agentId } })]);
  const missing = sent - recorded;
  console.log(
    missing > 0
      ? `  coverage: wallet has sent ${sent} txs, ${recorded} recorded as actions (the other ${missing} are setup txs such as identity registration, or need a --full history scan)`
      : `  coverage: wallet has sent ${sent} txs, all ${recorded} recorded`,
  );
}
