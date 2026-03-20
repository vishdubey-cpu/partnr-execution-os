import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBefore } from "date-fns";

export async function GET(_req: Request, { params }: { params: { owner: string } }) {
  const ownerName = decodeURIComponent(params.owner);

  try {
    const tasks = await prisma.task.findMany({
      where: { owner: { equals: ownerName, mode: "insensitive" }, status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const now = new Date();
    const enriched = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      source: t.source,
      dueDate: t.dueDate?.toISOString() ?? null,
      status: t.status,
      priority: t.priority,
      function: t.function,
      isOverdue: t.status !== "DONE" && !!t.dueDate && isBefore(t.dueDate, now),
      daysOverdue: t.dueDate && isBefore(t.dueDate, now)
        ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return NextResponse.json({ owner: ownerName, tasks: enriched });
  } catch (err) {
    console.error("[my-tasks] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
