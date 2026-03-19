import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/owners?name=vatsal
 * Returns the most recent phone + email for a given owner name (case-insensitive).
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json(null);

  const task = await prisma.task.findFirst({
    where: {
      owner: { equals: name, mode: "insensitive" },
      OR: [
        { ownerPhone: { not: "" } },
        { ownerEmail: { not: null } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { ownerPhone: true, ownerEmail: true },
  });

  return NextResponse.json(task ?? null);
}
