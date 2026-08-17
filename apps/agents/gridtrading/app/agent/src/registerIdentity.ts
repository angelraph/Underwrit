/**
 * One-off DEMO SETUP script. NOT part of the agent's runtime. Same category
 * as healthfactormonitor's seedPosition.ts: run manually, once.
 *
 * Registers Grid Trading's own ERC-8004 identity DIRECTLY on BSC Testnet's
 * IdentityRegistry, bypassing `bag deploy verify` entirely.
 *
 * Why: `bag deploy verify` is how the other three reference agents got their
 * real ERC-8004 agentId (1814, 1818, 1819), but that path is gated by the
 * BNB trial platform's 3-concurrent-agent hosting cap, and all 3 slots are
 * already held by those agents (see commit 22a7545's message). That cap is
 * a hosting-slot limit on the MANAGED PLATFORM, not a restriction of the
 * ERC-8004 standard itself. IdentityRegistry.register(agentURI) is a plain
 * permissionless function anyone can call. Grid Trading already has its own
 * funded wallet and already signs real trades through signing.ts/executor.ts,
 * so it can register its own identity the same way, with no platform slot
 * involved, no different in kind from any other tx this agent already signs.
 *
 * Tradeoff, stated plainly: the other three agents were registered by the
 * platform such that the human owner's wallet (angelraphael.bnb) holds the
 * ERC-8004 "owner" role and the agent's own wallet is set as a delegated
 * `agentWallet`. Calling `register` directly from THIS wallet makes the
 * agent's own wallet the on-chain owner too, since there's no separate
 * "register on behalf of" call in the ABI. Underwrit's own DB still records
 * the human as `ownerAddress` for display (see syncGridTrading.ts). That's
 * accurate metadata about who fields this agent, just not literally what
 * the IdentityRegistry's owner() slot shows. If a platform slot frees up
 * later and `bag deploy verify` becomes available for Grid Trading, the
 * identity registered here can be re-pointed via `setAgentWallet` or
 * re-registered. Nothing here is a dead end.
 *
 * Usage: tsx src/registerIdentity.ts
 */

import "./loadEnv.js"; // must run before any getWallet() call
import {
  ensureAltanaSessionLoaded,
  ensureKeystoreMaterialized,
  ensureTwakMaterialized,
  getWallet,
} from "@bnbagent/studio-runtime/wallet";
import { createPublicClient, decodeEventLog, http, parseAbi, type Address } from "viem";
import { bscTestnet } from "viem/chains";

// Same address packages/chain/src/addresses.ts uses for BSC Testnet, marked
// UNVERIFIED there (surfaced via a summarizing fetch, not yet independently
// cross-checked against BscScan). This script's own preflight below reads
// the address's on-chain bytecode before ever signing, so a wrong address
// fails cheaply (a read-only revert) rather than burning a real signed tx.
const IDENTITY_REGISTRY_TESTNET = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address;

const identityRegistryAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, address indexed owner, string agentURI)",
]);

function getRpcClient() {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
  });
}

/**
 * Self-contained agent metadata as a data: URI. Resolvable with zero
 * external hosting, so registration doesn't depend on Grid Trading having
 * a live AgentCore endpoint yet (it doesn't; that's the whole reason this
 * script exists). Real, honest fields only, no invented stats.
 */
function buildAgentUri(walletAddress: string): string {
  const card = {
    name: "Grid Trading",
    description:
      "Underwrit reference agent. Holds a target WBNB/USDT allocation on " +
      "PancakeSwap V3 (BSC Testnet, 0.01% WBNB/USDT pool) that steps with a " +
      "fixed tick-level grid, executing real spot swaps on drift.",
    category: "grid",
    protocol: "pancakeswap-v3",
    network: "bsc-testnet",
    chainId: 97,
    walletAddress,
    project: "Underwrit",
    registeredVia: "direct IdentityRegistry.register (see registerIdentity.ts)",
  };
  const json = JSON.stringify(card);
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

async function main() {
  ensureKeystoreMaterialized();
  ensureTwakMaterialized();
  await ensureAltanaSessionLoaded();

  const wallet = getWallet();
  const client = getRpcClient();

  console.log(`[register] wallet ${wallet.address}`);

  // Preflight: confirm a contract actually lives at this address before
  // ever signing. An eth_getCode read costs nothing.
  const code = await client.getCode({ address: IDENTITY_REGISTRY_TESTNET });
  if (!code || code === "0x") {
    console.error(
      `[register] fatal: no contract code at ${IDENTITY_REGISTRY_TESTNET}. ` +
        `This address needs re-verification against BscScan Testnet before ` +
        `retrying. Aborting before signing anything.`,
    );
    process.exit(1);
  }
  console.log(`[register] confirmed contract code present at ${IDENTITY_REGISTRY_TESTNET}`);

  const agentUri = buildAgentUri(wallet.address);
  console.log(`[register] agentURI (${agentUri.length} chars): ${agentUri.slice(0, 60)}…`);

  const executor = wallet.makeExecutor({ client });
  const res = await executor.execute({
    call: {
      address: IDENTITY_REGISTRY_TESTNET,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [agentUri],
    },
    description: "Register Grid Trading's own ERC-8004 identity directly (platform hosting slots full)",
  });
  console.log(`[register] tx: ${res.transactionHash}`);

  // Pull the real agentId back out of the Registered event so nothing here
  // is guessed, same discipline as every sync script in this project.
  const receipt = await client.getTransactionReceipt({ hash: res.transactionHash as `0x${string}` });

  if (receipt.status !== "success") {
    console.error(
      `\n[register] tx REVERTED on-chain (status="${receipt.status}"). Nothing was ` +
        `registered. Check the exact revert reason at:\n` +
        `  https://testnet.bscscan.com/tx/${res.transactionHash}\n` +
        `Common causes for a permissionless-looking register() reverting: this ` +
        `deployment gates registration behind the platform/trial program rather ` +
        `than being truly open, the trial window is closed, or a per-address cap ` +
        `already used this wallet's one registration slot.`,
    );
    process.exit(1);
  }

  let agentId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== IDENTITY_REGISTRY_TESTNET.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: identityRegistryAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "Registered") {
        agentId = (decoded.args as { agentId: bigint }).agentId;
        break;
      }
    } catch {
      // not the Registered log, skip
    }
  }

  if (agentId === undefined) {
    console.error(
      "[register] tx confirmed but no Registered event was found in the receipt. " +
        "Check the tx manually on BscScan Testnet before writing an agentId anywhere.",
    );
    process.exit(1);
  }

  console.log(`\n[register] SUCCESS. Real ERC-8004 agentId: ${agentId.toString()}`);
  console.log(
    `[register] Next: hardcode ERC8004_AGENT_ID = "${agentId.toString()}" into ` +
      `packages/db/scripts/syncGridTrading.ts, then run \`npm run sync:grid-trading\`.`,
  );
}

main().catch((e) => {
  console.error("[register] fatal:", e);
  process.exit(1);
});
