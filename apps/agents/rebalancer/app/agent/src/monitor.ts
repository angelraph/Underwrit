/**
 * Standalone rebalancing runner — same pattern as the other two reference
 * agents' monitor.ts. Separate from main.ts's A2A/ERC-8183 seller server:
 * this IS the reference agent Underwrit scores, independent of whether
 * anyone hires it as a paid seller.
 *
 * Usage: tsx src/monitor.ts
 */

import "./loadEnv.js"; // must run before any getWallet() call
import {
  ensureAltanaSessionLoaded,
  ensureKeystoreMaterialized,
  ensureTwakMaterialized,
  getWallet,
} from "@bnbagent/studio-runtime/wallet";
import { checkAndRebalance } from "./rebalancerCore.js";

async function main(): Promise<void> {
  ensureKeystoreMaterialized();
  ensureTwakMaterialized();
  await ensureAltanaSessionLoaded();

  const wallet = getWallet();
  console.log(`[rebalancer] checking ${wallet.address} on bsc-testnet (PancakeSwap V3 WBNB/USDT 0.01%)...`);

  const result = await checkAndRebalance();
  console.log(JSON.stringify(result, null, 2));

  if (result.actionTaken) {
    console.log(`[rebalancer] ACTED — ${result.action?.type}, tokenId ${result.action?.tokenId}, tx(s) ${result.action?.txHashes.join(", ")}`);
  } else {
    console.log(`[rebalancer] no action: ${result.skippedReason ?? "already in range"}`);
  }
}

main().catch((e) => {
  console.error("[rebalancer] fatal:", e);
  process.exit(1);
});
