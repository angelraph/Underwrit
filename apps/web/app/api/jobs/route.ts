import { NextResponse } from "next/server";
import { prisma, Category } from "@underwrit/db";
import type { JobConstraints } from "@underwrit/evidence-engine";
import { isAddress } from "viem";

interface CreateJobBody {
  userAddress: string;
  objectiveText: string;
  category: string;
  constraints: JobConstraints;
}

/**
 * Persists a real JobSpec — the first step of the previously-mocked
 * Job Contract -> Job Fit -> Trial -> Hire pipeline becoming real. Ranking
 * itself (rankAgentsForJob) was already real; it just had nothing real to
 * read from. This route is the missing write path.
 *
 * userAddress is required by the schema (a Job Contract belongs to a
 * specific requester) — the client only calls this once a real Altana
 * wallet exists, never with a placeholder.
 */
export async function POST(req: Request) {
  let body: CreateJobBody;
  try {
    body = (await req.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.userAddress || !isAddress(body.userAddress)) {
    return NextResponse.json({ error: "userAddress must be a valid 0x address. Connect a wallet first." }, { status: 400 });
  }
  if (!(body.category in Category)) {
    return NextResponse.json({ error: `unknown category "${body.category}"` }, { status: 400 });
  }
  const c = body.constraints;
  if (
    !c ||
    typeof c.maxCapital !== "number" ||
    typeof c.maxDailySpend !== "number" ||
    typeof c.maxDrawdownPct !== "number" ||
    typeof c.expiryDays !== "number" ||
    !Array.isArray(c.allowedProtocols)
  ) {
    return NextResponse.json({ error: "constraints missing required numeric fields" }, { status: 400 });
  }

  const jobSpec = await prisma.jobSpec.create({
    data: {
      userAddress: body.userAddress,
      objectiveText: body.objectiveText ?? "",
      category: body.category as Category,
      constraintsJson: {
        maxCapital: c.maxCapital,
        maxDailySpend: c.maxDailySpend,
        maxDrawdownPct: c.maxDrawdownPct,
        allowedProtocols: c.allowedProtocols,
        withdrawalsAllowed: !!c.withdrawalsAllowed,
        expiryDays: c.expiryDays,
      },
    },
  });

  return NextResponse.json({ id: jobSpec.id });
}
