import { NextResponse } from "next/server";
import { prisma } from "@underwrit/db";
import { isAddress } from "viem";

interface CreateSessionBody {
  jobSpecId: string;
  agentId: string; // our DB Agent.id, not the agent's wallet address
  walletAddress: string; // the hiring user's Altana wallet
  altanaSessionId?: string; // the session key's registered publicKey
  permissionsJson: unknown;
  expiry: number; // unix seconds
  grantTxHash?: string;
}

/**
 * Persists the result of a REAL client.grantSession(...) call (run
 * client-side against the user's own Altana wallet — this route never
 * touches a private key, it only records what already happened on-chain).
 */
export async function POST(req: Request) {
  let body: CreateSessionBody;
  try {
    body = (await req.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.jobSpecId || !body.agentId) {
    return NextResponse.json({ error: "jobSpecId and agentId are required" }, { status: 400 });
  }
  if (!body.walletAddress || !isAddress(body.walletAddress)) {
    return NextResponse.json({ error: "walletAddress must be a valid 0x address" }, { status: 400 });
  }
  if (typeof body.expiry !== "number" || body.expiry <= Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "expiry must be a future unix timestamp" }, { status: 400 });
  }

  const [jobSpec, agent] = await Promise.all([
    prisma.jobSpec.findUnique({ where: { id: body.jobSpecId } }),
    prisma.agent.findUnique({ where: { id: body.agentId } }),
  ]);
  if (!jobSpec) return NextResponse.json({ error: "unknown jobSpecId" }, { status: 404 });
  if (!agent) return NextResponse.json({ error: "unknown agentId" }, { status: 404 });

  const session = await prisma.session.create({
    data: {
      jobSpecId: body.jobSpecId,
      agentId: body.agentId,
      altanaSessionId: body.altanaSessionId ?? null,
      walletAddress: body.walletAddress,
      permissionsJson: body.permissionsJson as object,
      expiry: new Date(body.expiry * 1000),
      grantTxHash: body.grantTxHash ?? null,
    },
  });

  return NextResponse.json({ id: session.id });
}
