import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBefore, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minDays = parseInt(searchParams.get("minDays") || "0");
    const fn = searchParams.get("function");
    const owner = searchParams.get("owner");

    const now = new Date();

    const where: Record<string, unknown> = {
      status: { not: "DONE" },
      dueDate: { lt: minDays > 0 ? subDays(now, minDays) : now },
    };

    if (fn && fn !== "ALL") where.function = fn;
    if (owner && owner !== "ALL") where.owner = { contains: owner };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });

    const enriched = tasks.map((t) => {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { ...t, daysOverdue };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Overdue tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch overdue tasks" }, { status: 500 });
  }
}
