/**
 * Standalone grid-trading runner — same pattern as the other three
 * reference agents' monitor.ts. Separate from main.ts's A2A/ERC-8183 seller
 * server: this IS the reference agent Underwrit scores, independent of
 * whether anyone hires it as a paid seller.
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
import { checkAndTrade } from "./gridTradingCore.js";

async function main(): Promise<void> {
  ensureKeystoreMaterialized();
  ensureTwakMaterialized();
  await ensureAltanaSessionLoaded();

  const wallet = getWallet();
  console.log(`[gridtrading] checking ${wallet.address} on bsc-testnet (PancakeSwap V3 WBNB/USDT 0.01%)...`);

  const result = await checkAndTrade();
  console.log(JSON.stringify(result, null, 2));

  if (result.actionTaken) {
    console.log(`[gridtrading] ACTED — ${result.action?.type}, tx(s) ${result.action?.txHashes.join(", ")}`);
  } else {
    console.log(`[gridtrading] no action: ${result.skippedReason ?? "within deadband"}`);
  }
}

main().catch((e) => {
  console.error("[gridtrading] fatal:", e);
  process.exit(1);
});
