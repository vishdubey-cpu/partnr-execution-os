import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/tasks/bulk-delete
 * Body: { ids: string[] }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    await prisma.task.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
