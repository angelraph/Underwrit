/**
 * Standalone yield-routing runner, same pattern as the Health Factor
 * Guardian's monitor.ts. Separate from main.ts's A2A/ERC-8183 seller server:
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
import { checkAndOptimize } from "./yieldRouterCore.js";
import { recordAction } from "./actionJournal.js";

async function main(): Promise<void> {
  ensureKeystoreMaterialized();
  ensureTwakMaterialized();
  await ensureAltanaSessionLoaded();

  const wallet = getWallet();
  console.log(`[yield-router] checking ${wallet.address} on bsc-testnet (Venus Core Pool)...`);

  const result = await checkAndOptimize();
  console.log(JSON.stringify(result, null, 2));

  if (result.actionTaken && result.action) {
    recordAction({
      action: result.action.type,
      detectedAt: result.timestamp,
      legs: [{ hash: result.action.txHash, type: "supply_bnb" }],
      params: { protocol: "venus", market: result.bestMarket, amountRaw: result.action.amountRaw },
    });
    console.log(`[yield-router] ACTED, supplied to ${result.bestMarket}, tx ${result.action?.txHash}`);
  } else {
    console.log(`[yield-router] no action: ${result.skippedReason ?? "already optimally allocated"}`);
  }
}

main().catch((e) => {
  console.error("[yield-router] fatal:", e);
  process.exit(1);
});
