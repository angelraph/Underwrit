/**
 * Yield Router — the agent's actual value: compare real Venus Protocol
 * supply APY across markets and route idle capital to whichever is
 * genuinely best, using only rates read live from the chain (a per-block
 * rate mantissa + an actually-measured block time — never a hardcoded
 * annualization constant).
 *
 * Same discipline as the Health Factor Guardian's healthFactorGuard.ts: this
 * is fixed code, never an LLM tool. The LLM (if this agent is ever hired via
 * ERC-8183) may describe the comparison in prose; it never decides or signs.
 *
 * v1 scope: compares vBNB vs vUSDT supply APY and can act on vBNB (native,
 * no swap needed). When vUSDT is genuinely better, it reports that honestly
 * instead of pretending to act — this agent has no BNB->USDT swap path
 * wired yet (a real PancakeSwap V3 SmartRouter integration, deferred rather
 * than rushed). Lista liquid staking is out of scope entirely for now: it
 * has no BSC Testnet deployment (verified during research), so there is
 * nothing real to route into there until this graduates to mainnet.
 */

import { getWallet } from "@bnbagent/studio-runtime/wallet";
import { formatEther, parseEther } from "viem";
import {
  getSupplyApyPct,
  getVenusPublicClient,
  VENUS_TESTNET,
  vBep20Abi,
  vBnbAbi,
} from "./venus.js";

const RESERVE_BNB = parseEther("0.05"); // always keep this much for gas, never route it

export interface YieldCandidate {
  market: string;
  asset: string;
  apyPct: number;
}

export interface YieldCheckResult {
  timestamp: string;
  candidates: YieldCandidate[];
  bestMarket: string;
  actionTaken: boolean;
  action?: {
    type: "supply_bnb";
    amountRaw: string;
    txHash: string;
  };
  skippedReason?: string;
}

export async function checkAndOptimize(): Promise<YieldCheckResult> {
  const wallet = getWallet();
  const client = getVenusPublicClient();
  const timestamp = new Date().toISOString();

  const [bnbApy, usdtApy] = await Promise.all([
    getSupplyApyPct(VENUS_TESTNET.vBNB, vBnbAbi),
    getSupplyApyPct(VENUS_TESTNET.vUSDT, vBep20Abi),
  ]);

  const candidates: YieldCandidate[] = [
    { market: "vBNB", asset: "BNB", apyPct: bnbApy },
    { market: "vUSDT", asset: "USDT", apyPct: usdtApy },
  ];
  const best = candidates.reduce((a, b) => (b.apyPct > a.apyPct ? b : a));

  const base: YieldCheckResult = {
    timestamp,
    candidates,
    bestMarket: best.market,
    actionTaken: false,
  };

  if (best.market !== "vBNB") {
    return {
      ...base,
      skippedReason: `${best.market} currently offers the best real supply APY (${best.apyPct.toFixed(2)}%), but this agent has no BNB→USDT swap path wired yet — holding rather than faking a cross-asset move`,
    };
  }

  const nativeBalance = await client.getBalance({ address: wallet.address });
  if (nativeBalance <= RESERVE_BNB) {
    return {
      ...base,
      skippedReason: `vBNB is best (${bnbApy.toFixed(2)}%) but no idle BNB above the ${formatEther(RESERVE_BNB)} gas reserve to supply`,
    };
  }

  const available = nativeBalance - RESERVE_BNB;
  const executor = wallet.makeExecutor({ client });
  const res = await executor.execute({
    call: { address: VENUS_TESTNET.vBNB, abi: vBnbAbi, functionName: "mint", args: [] },
    value: available,
    description: `Supply ${formatEther(available)} idle BNB to Venus (best real supply APY: ${bnbApy.toFixed(2)}%)`,
  });

  return {
    ...base,
    actionTaken: true,
    action: {
      type: "supply_bnb",
      amountRaw: available.toString(),
      txHash: res.transactionHash,
    },
  };
}
