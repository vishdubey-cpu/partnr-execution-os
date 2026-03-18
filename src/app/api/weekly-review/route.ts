import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, isBefore } from "date-fns";
import { buildWeeklySummaryMessage } from "@/lib/whatsapp";

export async function GET() {
  try {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const allTasks = await prisma.task.findMany();

    const createdTasks = allTasks.filter(
      (t) =>
        new Date(t.createdAt) >= weekStart && new Date(t.createdAt) <= weekEnd
    );

    const closedTasks = allTasks.filter(
      (t) =>
        t.status === "DONE" &&
        t.closedAt &&
        new Date(t.closedAt) >= weekStart &&
        new Date(t.closedAt) <= weekEnd
    );

    const overdueTasks = allTasks.filter(
      (t) => t.status !== "DONE" && !!t.dueDate && isBefore(t.dueDate, now)
    );

    // Build owner stats for the week
    const ownerMap: Record<string, { function: string; tasks: typeof allTasks }> = {};
    for (const task of allTasks) {
      if (!ownerMap[task.owner]) {
        ownerMap[task.owner] = { function: task.function, tasks: [] };
      }
      ownerMap[task.owner].tasks.push(task);
    }

    const ownerStats = Object.entries(ownerMap).map(([owner, data]) => {
      const tasks = data.tasks;
      const done = tasks.filter((t) => t.status === "DONE").length;
      const overdue = tasks.filter(
        (t) => t.status !== "DONE" && !!t.dueDate && isBefore(t.dueDate, now)
      ).length;
      const delayed = tasks.filter((t) => t.status === "DELAYED").length;
      const open = tasks.filter((t) => t.status === "OPEN").length;
      const closureRate =
        tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      return {
        owner,
        function: data.function,
        total: tasks.length,
        open,
        done,
        overdue,
        delayed,
        closureRate,
      };
    });

    const topPerformers = [...ownerStats]
      .filter((o) => o.done > 0)
      .sort((a, b) => b.closureRate - a.closureRate)
      .slice(0, 3);

    const attentionNeeded = [...ownerStats]
      .filter((o) => o.overdue > 0 || o.closureRate < 50)
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 5);

    const onTimeDone = allTasks.filter(
      (t) => t.status === "DONE" && t.closedAt && !!t.dueDate && !isBefore(t.dueDate, new Date(t.closedAt))
    ).length;
    const doneTasks = allTasks.filter((t) => t.status === "DONE");
    const onTimeClosureRate = doneTasks.length > 0 ? Math.round((onTimeDone / doneTasks.length) * 100) : 0;

    const whatsappSummaryText = buildWeeklySummaryMessage({
      periodStart: weekStart.toISOString(),
      periodEnd: weekEnd.toISOString(),
      tasksCreated: createdTasks.length,
      tasksClosed: closedTasks.length,
      overdueCount: overdueTasks.length,
      onTimeClosureRate,
      topPerformers: topPerformers.map((p) => ({
        owner: p.owner,
        closureRate: p.closureRate,
        done: p.done,
        total: p.total,
      })),
      attentionNeeded: attentionNeeded.map((p) => ({
        owner: p.owner,
        overdue: p.overdue,
        closureRate: p.closureRate,
      })),
      pendingDecisions: overdueTasks.slice(0, 5).map((t) => ({
        title: t.title,
        owner: t.owner,
        daysOverdue: t.dueDate ? Math.floor((Date.now() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      })),
    });

    return NextResponse.json({
      periodStart: weekStart.toISOString(),
      periodEnd: weekEnd.toISOString(),
      tasksCreated: createdTasks.length,
      tasksClosed: closedTasks.length,
      overdueCount: overdueTasks.length,
      ownerStats,
      topPerformers,
      attentionNeeded,
      createdTasks,
      closedTasks,
      overdueTasks,
      whatsappSummaryText,
    });
  } catch (error) {
    console.error("Weekly review error:", error);
    return NextResponse.json({ error: "Failed to generate weekly review" }, { status: 500 });
  }
}
