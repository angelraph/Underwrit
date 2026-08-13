/**
 * Standalone guardian runner — the self-custody loop that generates
 * Underwrit's real evidence data for this agent.
 *
 * Deliberately separate from `main.ts`'s A2A/ERC-8183 seller server: this
 * script IS the "reference agent" the marketplace scores — it watches this
 * wallet's own Venus position and repays before liquidation, independent of
 * whether anyone has ever hired it as a paid seller. Run it repeatedly
 * (cron, a GitHub Action, or by hand during the hackathon build) to build up
 * the real Action history the Evidence Engine reads.
 *
 * Usage: tsx src/monitor.ts [--buffer=1]
 */

import "./loadEnv.js"; // must run before any getWallet() call — see loadEnv.ts
import {
  ensureAltanaSessionLoaded,
  ensureKeystoreMaterialized,
  ensureTwakMaterialized,
  getWallet,
} from "@bnbagent/studio-runtime/wallet";
import { checkAndProtect } from "./healthFactorGuard.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const buffer = args.find((a) => a.startsWith("--buffer="))?.split("=")[1];
  return { safetyBufferUsd: buffer ? Number(buffer) : undefined };
}

async function main(): Promise<void> {
  ensureKeystoreMaterialized();
  ensureTwakMaterialized();
  await ensureAltanaSessionLoaded();

  const { safetyBufferUsd } = parseArgs();
  const wallet = getWallet();
  console.log(`[guardian] checking ${wallet.address} on bsc-testnet (Venus Core Pool)...`);

  const result = await checkAndProtect({ safetyBufferUsd });
  console.log(JSON.stringify(result, null, 2));

  if (result.actionTaken) {
    console.log(`[guardian] ACTED — ${result.tier} → repaid, tx ${result.action?.repayTxHash}`);
  } else if (result.tier === "AT_RISK" || result.tier === "UNDERWATER") {
    console.log(`[guardian] ${result.tier} but took no action: ${result.skippedReason ?? "unknown reason"}`);
  } else {
    console.log(`[guardian] ${result.tier} — no action needed`);
  }
}

main().catch((e) => {
  console.error("[guardian] fatal:", e);
  process.exit(1);
});
