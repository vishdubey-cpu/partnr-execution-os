import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isToday, isBefore } from "date-fns";

// Safe helpers — handle tasks with no due date
const isOverdue = (dueDate: Date | null, status: string) =>
  status === "OVERDUE" || (status !== "DONE" && !!dueDate && isBefore(dueDate, new Date()));

const isDueToday = (dueDate: Date | null, status: string) =>
  status !== "DONE" && !!dueDate && isToday(dueDate);

export async function GET() {
  try {
    const now = new Date();

    const allTasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    });

    const totalOpenTasks = allTasks.filter(
      (t) => t.status === "OPEN" || t.status === "DELAYED"
    ).length;

    const overdueTasks = allTasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const dueTodayTasks = allTasks.filter((t) => isDueToday(t.dueDate, t.status)).length;

    const doneTasks = allTasks.filter((t) => t.status === "DONE");
    const onTimeDone = doneTasks.filter(
      (t) => t.closedAt && t.dueDate && !isBefore(t.dueDate, t.closedAt)
    ).length;
    const onTimeClosureRate =
      doneTasks.length > 0
        ? Math.round((onTimeDone / doneTasks.length) * 100)
        : 0;

    // Build owner stats
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
      const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
      const delayed = tasks.filter((t) => t.status === "DELAYED").length;
      const open = tasks.filter((t) => t.status === "OPEN").length;
      const closureRate =
        tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      const executionScore = tasks.length > 0
        ? Math.max(0, Math.min(100, Math.round((done / tasks.length) * 100 - (overdue / tasks.length) * 30)))
        : 0;
      return {
        owner,
        function: data.function,
        total: tasks.length,
        open,
        done,
        overdue,
        delayed,
        closureRate,
        executionScore,
      };
    });

    ownerStats.sort((a, b) => b.total - a.total);

    const overdueTasksSummary = allTasks
      .filter((t) => isOverdue(t.dueDate, t.status))
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      })
      .slice(0, 10);

    // Tasks due in next 3 days (not overdue, not done)
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dueSoonSummary = allTasks
      .filter((t) => {
        if (t.status === "DONE" || !t.dueDate) return false;
        if (isOverdue(t.dueDate, t.status)) return false; // already in overdueTasksSummary
        if (isToday(t.dueDate)) return false; // already counted in dueTodayTasks
        return t.dueDate <= in3Days;
      })
      .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
      .slice(0, 5);

    const recentTasks = allTasks.slice(0, 8);

    // Tasks needing escalation: overdue 3+ days, escalationLevel still 0
    const needsEscalation = allTasks
      .filter((t) => {
        if (t.status === "DONE" || !t.dueDate) return false;
        const daysOverdue = Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysOverdue >= 3 && t.escalationLevel < 1;
      })
      .slice(0, 6);

    // Silent overdue: tasks that are overdue AND owner has never replied via inbound
    const inboundReplies = await prisma.reminder.findMany({
      where: { type: "INBOUND_REPLY" },
      select: { taskId: true },
    });
    const repliedTaskIds = new Set(inboundReplies.map((r) => r.taskId));

    const silentOverdue = allTasks
      .filter((t) => {
        if (t.status === "DONE" || !t.dueDate) return false;
        if (!isOverdue(t.dueDate, t.status)) return false;
        return !repliedTaskIds.has(t.id);
      })
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      })
      .slice(0, 6);

    // Recent reminders sent
    const recentReminders = await prisma.reminder.findMany({
      where: { type: { not: "INBOUND_REPLY" } },
      orderBy: { sentAt: "desc" },
      take: 8,
      include: { task: { select: { title: true, owner: true } } },
    });

    return NextResponse.json({
      totalOpenTasks,
      overdueTasks,
      dueTodayTasks,
      onTimeClosureRate,
      ownerStats,
      recentTasks,
      overdueTasksSummary,
      dueSoonSummary,
      needsEscalation,
      silentOverdue,
      recentReminders,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
