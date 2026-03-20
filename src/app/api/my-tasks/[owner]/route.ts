import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBefore } from "date-fns";

export async function GET(_req: Request, { params }: { params: { owner: string } }) {
  const ownerName = decodeURIComponent(params.owner);

  try {
    // Active (non-done) tasks
    const tasks = await prisma.task.findMany({
      where: { owner: { equals: ownerName, mode: "insensitive" }, status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    // Done tasks — for reliability calculation
    const doneTasks = await prisma.task.findMany({
      where: { owner: { equals: ownerName, mode: "insensitive" }, status: "DONE" },
      select: { id: true, dueDate: true, closedAt: true, delayCount: true },
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

    // ── Reliability calculation ────────────────────────────────
    const doneWithDeadline = doneTasks.filter((t) => t.dueDate && t.closedAt);
    const onTimeDone = doneWithDeadline.filter((t) => t.closedAt! <= t.dueDate!);
    const onTimeRate = doneWithDeadline.length > 0
      ? Math.round((onTimeDone.length / doneWithDeadline.length) * 100)
      : null;

    const totalDelayCount =
      tasks.reduce((s, t) => s + (t.delayCount || 0), 0) +
      doneTasks.reduce((s, t) => s + (t.delayCount || 0), 0);

    const reliabilityLabel: "STRONG" | "WATCH" | "AT_RISK" | null =
      onTimeRate === null ? null :
      onTimeRate >= 70    ? "STRONG" :
      onTimeRate >= 40    ? "WATCH"  : "AT_RISK";

    const patternInsight =
      totalDelayCount >= 3  ? `${totalDelayCount} delays recorded across tasks` :
      totalDelayCount === 2 ? `2 delays recorded — watch the pattern` :
      totalDelayCount === 1 ? `1 delay recorded` :
      doneWithDeadline.length === 0 ? `No completed tasks yet` :
      `${onTimeDone.length} of ${doneWithDeadline.length} tasks delivered on time`;

    const reliability = {
      doneTasks: doneTasks.length,
      onTimeCount: onTimeDone.length,
      lateCount: doneWithDeadline.length - onTimeDone.length,
      onTimeRate,
      totalDelayCount,
      reliabilityLabel,
      patternInsight,
    };

    return NextResponse.json({ owner: ownerName, tasks: enriched, reliability });
  } catch (err) {
    console.error("[my-tasks] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
