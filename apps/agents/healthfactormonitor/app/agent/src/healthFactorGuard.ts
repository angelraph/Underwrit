/**
 * Health Factor Guardian — the agent's actual value: watch this wallet's
 * Venus Protocol borrow position and repay before it's liquidatable.
 *
 * This is deliberately FIXED code, not an LLM tool — same discipline as
 * `signing.ts`: money never moves through the LLM. `runWork` (main.ts) may
 * describe a check in prose for a paying ERC-8183 buyer, but the actual
 * read-decide-repay sequence below is the only thing that ever signs.
 *
 * Safety boundary: this module NEVER writes to any account other than the
 * agent's own wallet. Third parties can pay to have their account *read*
 * (via the `venus.ts` read functions + tools.ts), never protected — acting
 * on someone else's position would require them to hand over their key,
 * which nothing here does or should do.
 */

import { getWallet } from "@bnbagent/studio-runtime/wallet";
import type { Address } from "viem";
import {
  erc20Abi,
  getAccountLiquidity,
  getVenusPublicClient,
  getVUsdtBorrowBalance,
  getVUsdtUnderlying,
  VENUS_TESTNET,
  vBep20Abi,
  type AccountLiquidity,
} from "./venus.js";

export type RiskTier = "HEALTHY" | "MODERATE" | "AT_RISK" | "UNDERWATER";

export interface HealthCheckResult {
  account: Address;
  timestamp: string;
  tier: RiskTier;
  liquidityUsd: string; // decimal string, human-scale (not raw 1e18)
  shortfallUsd: string;
  actionTaken: boolean;
  action?: {
    type: "repay_vusdt";
    amountRaw: string;
    approveTxHash: string | null;
    repayTxHash: string;
  };
  skippedReason?: string;
}

const ONE_USD = 10n ** 18n;

function toDecimalString(raw: bigint, decimals = 18): string {
  const whole = raw / 10n ** BigInt(decimals);
  const frac = raw % 10n ** BigInt(decimals);
  return `${whole}.${frac.toString().padStart(decimals, "0").slice(0, 4)}`;
}

/**
 * Classify Comptroller.getAccountLiquidity output into a risk tier.
 *
 * shortfallUsd > 0 means the position is ALREADY liquidatable (Venus's own
 * liquidation bots can act on it right now) — UNDERWATER. Below that, we
 * grade by remaining spare capacity against a configurable USD buffer: this
 * is the same signal a liquidation bot watches trending toward zero, just
 * acted on before it crosses, not after.
 */
export function assessRisk(
  liquidity: AccountLiquidity,
  safetyBufferUsd: number,
): RiskTier {
  if (liquidity.errored) return "AT_RISK"; // unknown state — treat as risky, never as healthy
  if (liquidity.shortfallUsd > 0n) return "UNDERWATER";
  // safetyBufferUsd is a plain JS number (e.g. 1.5) — scale to 1e18 fixed point
  // via a 1e6 intermediate so fractional USD values survive the conversion.
  const buffer = BigInt(Math.round(safetyBufferUsd * 1_000_000)) * (ONE_USD / 1_000_000n);
  if (liquidity.liquidityUsd < buffer) return "AT_RISK";
  if (liquidity.liquidityUsd < buffer * 3n) return "MODERATE";
  return "HEALTHY";
}

/** Repay `amountRaw` of the agent's own vUSDT borrow — approve then repayBorrow, both real signed txs. */
async function repayVUsdt(amountRaw: bigint): Promise<{ approveTxHash: string | null; repayTxHash: string }> {
  const wallet = getWallet();
  const client = getVenusPublicClient();
  const executor = wallet.makeExecutor({ client });
  const underlying = await getVUsdtUnderlying();

  const allowance = await client.readContract({
    address: underlying,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet.address, VENUS_TESTNET.vUSDT],
  });

  let approveTxHash: string | null = null;
  if (allowance < amountRaw) {
    const res = await executor.execute({
      call: {
        address: underlying,
        abi: erc20Abi,
        functionName: "approve",
        args: [VENUS_TESTNET.vUSDT, amountRaw],
      },
      description: "Approve vUSDT to pull USDT for repayBorrow",
    });
    approveTxHash = res.transactionHash;
  }

  const repayRes = await executor.execute({
    call: {
      address: VENUS_TESTNET.vUSDT,
      abi: vBep20Abi,
      functionName: "repayBorrow",
      args: [amountRaw],
    },
    description: "Repay Venus USDT borrow to restore account health",
  });

  return { approveTxHash, repayTxHash: repayRes.transactionHash };
}

export interface GuardOpts {
  /** USD headroom below which the position is considered AT_RISK and the guardian acts. Default $1 — deliberately small for testnet-scale positions. */
  safetyBufferUsd?: number;
  /** Fraction of the outstanding vUSDT borrow to repay when acting. Default 1 (full repay) for UNDERWATER, 0.5 for AT_RISK. */
  repayFraction?: number;
  /** Cap the repay amount to what the wallet's own USDT balance can actually cover — never attempt a doomed tx. Default true. */
  capToBalance?: boolean;
}

/**
 * One guardian check: read the agent's own Venus position, classify it, and
 * repay if needed. Always returns a result, whether or not it acted — a
 * HEALTHY check is itself a real, loggable Action (evidence that the
 * guardian is watching, not just that it occasionally intervenes).
 */
export async function checkAndProtect(opts: GuardOpts = {}): Promise<HealthCheckResult> {
  const wallet = getWallet();
  const account = wallet.address;
  const safetyBufferUsd = opts.safetyBufferUsd ?? 1;
  const timestamp = new Date().toISOString();

  const liquidity = await getAccountLiquidity(account);
  const tier = assessRisk(liquidity, safetyBufferUsd);

  const base: HealthCheckResult = {
    account,
    timestamp,
    tier,
    liquidityUsd: toDecimalString(liquidity.liquidityUsd),
    shortfallUsd: toDecimalString(liquidity.shortfallUsd),
    actionTaken: false,
  };

  if (tier !== "AT_RISK" && tier !== "UNDERWATER") {
    return base;
  }

  const outstanding = await getVUsdtBorrowBalance(account);
  if (outstanding === 0n) {
    return { ...base, skippedReason: "no outstanding vUSDT borrow to repay" };
  }

  const fraction = opts.repayFraction ?? (tier === "UNDERWATER" ? 1 : 0.5);
  let repayAmount = (outstanding * BigInt(Math.round(fraction * 1000))) / 1000n;

  if (opts.capToBalance ?? true) {
    const underlying = await getVUsdtUnderlying();
    const client = getVenusPublicClient();
    const ownBalance = await client.readContract({
      address: underlying,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    });
    if (ownBalance === 0n) {
      return {
        ...base,
        skippedReason: `position is ${tier} but wallet holds 0 USDT to repay with — needs funding`,
      };
    }
    if (repayAmount > ownBalance) repayAmount = ownBalance;
  }

  const { approveTxHash, repayTxHash } = await repayVUsdt(repayAmount);

  return {
    ...base,
    actionTaken: true,
    action: {
      type: "repay_vusdt",
      amountRaw: repayAmount.toString(),
      approveTxHash,
      repayTxHash,
    },
  };
}
