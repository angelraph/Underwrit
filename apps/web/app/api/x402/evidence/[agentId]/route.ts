import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { createX402Merchant, U_TOKEN } from "@altananetwork/x402-server";
import { prisma } from "@underwrit/db";
import { BNB_TESTNET } from "../../../../lib/altana";

/**
 * Sells real evidence history over x402/B402 — the Altana "Best Built with
 * Altana" bonus track's sell-side requirement. The payload is genuinely
 * useful, not a stub: another agent doing due diligence on one of
 * Underwrit's reference agents can buy the full EvidenceSnapshot timeline
 * (every real confidence/cost/action reading since the agent went live),
 * the same data the free UI only shows the latest snapshot of.
 *
 * The facilitator is a dedicated fresh EOA that only ever broadcasts
 * settlement transactions (its own gas) — it never custodies buyer funds,
 * those settle straight to X402_PAYOUT_ADDRESS. See
 * docs/x402-facilitator-funding.md for what it still needs to go live.
 */
function getMerchant(agentId: string) {
  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY;
  const payTo = process.env.X402_PAYOUT_ADDRESS;
  if (!pk || !payTo) return null;

  const facilitator = privateKeyToAccount(pk as `0x${string}`);
  const chainId = BNB_TESTNET.chainId as 56 | 97;

  return createX402Merchant({
    chainId: BNB_TESTNET.chainId,
    payTo: payTo as `0x${string}`,
    price: BigInt("10000000000000000"), // 0.01 $U
    rails: [{ rail: "eip3009", token: U_TOKEN[chainId] }],
    facilitator,
    rpcUrl: BNB_TESTNET.publicRpcUrl,
    chain: BNB_TESTNET.chain,
    resource: {
      url: `https://underwrit-web.vercel.app/api/x402/evidence/${agentId}`,
      description:
        "Full EvidenceSnapshot history for one Underwrit reference agent: every real confidence, cost, and action reading since it went live, not just the latest.",
      mimeType: "application/json",
    },
    description: "Underwrit reference agent evidence history",
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const merchant = getMerchant(agentId);
  if (!merchant) {
    return NextResponse.json(
      { error: "x402 selling isn't configured on this deployment yet" },
      { status: 503 }
    );
  }

  const { response, receipt } = await merchant.guard(req);
  if (response) return response;

  const snapshots = await prisma.evidenceSnapshot.findMany({
    where: { agentId },
    orderBy: { computedAt: "asc" },
  });
  if (snapshots.length === 0) {
    return NextResponse.json({ error: "No evidence recorded for this agent yet" }, { status: 404 });
  }

  return NextResponse.json({
    agentId,
    paidVia: "x402",
    receipt: receipt && {
      settleTxHash: receipt.txHash,
      payer: receipt.payer,
      amount: receipt.amount.toString(),
    },
    snapshots,
  });
}
