import { NextResponse } from "next/server";
import { prisma, SessionStatus } from "@underwrit/db";

interface RevokeBody {
  revokeTxHash?: string;
}

/**
 * Records a REAL client.revokeSession(...) result (run client-side against
 * the user's own wallet, same as granting — this route only persists what
 * already happened on-chain).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: RevokeBody = {};
  try {
    body = (await req.json()) as RevokeBody;
  } catch {
    // empty body is fine — revokeTxHash is optional
  }

  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "unknown session id" }, { status: 404 });

  const session = await prisma.session.update({
    where: { id },
    data: { status: SessionStatus.REVOKED, revokeTxHash: body.revokeTxHash ?? null },
  });

  return NextResponse.json({ id: session.id, status: session.status });
}
