/**
 * One-off DEMO SETUP script — NOT part of the agent's runtime.
 *
 * Opens a real Venus Protocol testnet position (supply BNB collateral,
 * borrow USDT) so the guardian (`healthFactorGuard.ts` / `monitor.ts`) has an
 * actual position to watch and, if borrowed aggressively enough, protect.
 * Run manually once before the first `monitor.ts` pass.
 *
 * Usage:
 *   tsx src/seedPosition.ts [--collateral=0.05] [--borrow=1]
 *
 * --collateral is BNB supplied as collateral (default 0.05 BNB, leaves most
 *   of the funded 0.3 tBNB for gas across many runs).
 * --borrow is a DIRECT decimal amount of USDT to borrow (default a small,
 *   conservative 1 USDT — deliberately not computed as "N% of capacity",
 *   since that requires trusting an assumed price-oracle scaling we haven't
 *   independently verified for this testnet deployment; a small fixed amount
 *   plus the transaction's own on-chain revert is the safer guardrail). Raise
 *   it manually and re-run `monitor.ts` if you want to demo the guardian's
 *   repay path against a position closer to its limit.
 */

import "./loadEnv.js"; // must run before any getWallet() call — see loadEnv.ts
import {
  ensureAltanaSessionLoaded,
  ensureKeystoreMaterialized,
  ensureTwakMaterialized,
  getWallet,
} from "@bnbagent/studio-runtime/wallet";
import { parseEther, parseUnits } from "viem";
import {
  erc20Abi,
  getAccountLiquidity,
  getVenusPublicClient,
  getVUsdtUnderlying,
  VENUS_TESTNET,
  vBep20Abi,
  vBnbAbi,
  venusComptrollerAbi,
} from "./venus.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, dflt: string) =>
    args.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1] ?? dflt;
  return {
    collateralBnb: get("collateral", "0.05"),
    borrowUsdt: get("borrow", "1"),
  };
}

async function main() {
  ensureKeystoreMaterialized();
  ensureTwakMaterialized();
  await ensureAltanaSessionLoaded();

  const { collateralBnb, borrowUsdt } = parseArgs();
  const wallet = getWallet();
  const client = getVenusPublicClient();
  const executor = wallet.makeExecutor({ client });

  console.log(`[seed] wallet ${wallet.address}`);
  console.log(`[seed] supplying ${collateralBnb} BNB as collateral to vBNB...`);

  const mintRes = await executor.execute({
    call: { address: VENUS_TESTNET.vBNB, abi: vBnbAbi, functionName: "mint", args: [] },
    value: parseEther(collateralBnb),
    description: `Supply ${collateralBnb} BNB collateral to Venus`,
  });
  console.log(`[seed] mint tx: ${mintRes.transactionHash}`);

  console.log(`[seed] entering vBNB market as collateral...`);
  const enterRes = await executor.execute({
    call: {
      address: VENUS_TESTNET.comptroller,
      abi: venusComptrollerAbi,
      functionName: "enterMarkets",
      args: [[VENUS_TESTNET.vBNB]],
    },
    description: "Enable vBNB as collateral",
  });
  console.log(`[seed] enterMarkets tx: ${enterRes.transactionHash}`);

  const liquidity = await getAccountLiquidity(wallet.address);
  console.log(
    `[seed] Comptroller reports liquidity=${liquidity.liquidityUsd} shortfall=${liquidity.shortfallUsd} (1e18-scaled USD)`,
  );
  if (liquidity.liquidityUsd === 0n) {
    console.log("[seed] no borrowing capacity reported yet — stopping before the borrow step.");
    return;
  }

  const underlying = await getVUsdtUnderlying();
  const decimals = await client.readContract({
    address: underlying,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const borrowAmount = parseUnits(borrowUsdt, decimals);
  console.log(`[seed] borrowing ${borrowUsdt} USDT (${decimals} decimals) against BNB collateral...`);

  const borrowRes = await executor.execute({
    call: {
      address: VENUS_TESTNET.vUSDT,
      abi: vBep20Abi,
      functionName: "borrow",
      args: [borrowAmount],
    },
    description: `Borrow ${borrowUsdt} USDT against BNB collateral (demo seed)`,
  });
  console.log(`[seed] borrow tx: ${borrowRes.transactionHash}`);
  console.log("[seed] done — run `tsx src/monitor.ts` to check the resulting position.");
}

main().catch((e) => {
  console.error("[seed] fatal:", e);
  process.exit(1);
});
