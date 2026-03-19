import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isToday, isBefore } from "date-fns";
import type { PulseTask, ZombieTask } from "@/types";

const isOverdue = (dueDate: Date | null, status: string) =>
  status === "OVERDUE" || (status !== "DONE" && !!dueDate && isBefore(dueDate, new Date()));

const isDueToday = (dueDate: Date | null, status: string) =>
  status !== "DONE" && !!dueDate && isToday(dueDate);

export async function GET() {
  try {
    const now = new Date();

    const allTasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });

    // Activity map: last activity date per task + delay count
    const activities = await prisma.activity.findMany({
      select: { taskId: true, createdAt: true, message: true },
      orderBy: { createdAt: "desc" },
    });

    const lastActivityMap: Record<string, Date> = {};
    const delayCountMap: Record<string, number> = {};
    for (const a of activities) {
      if (!lastActivityMap[a.taskId]) lastActivityMap[a.taskId] = a.createdAt;
      if (a.message?.toLowerCase().includes("delayed")) {
        delayCountMap[a.taskId] = (delayCountMap[a.taskId] || 0) + 1;
      }
    }

    // Inbound replies
    const inboundReplies = await prisma.reminder.findMany({
      where: { type: "INBOUND_REPLY" },
      select: { taskId: true },
    });
    const repliedTaskIds = new Set(inboundReplies.map((r) => r.taskId));

    const totalOpenTasks = allTasks.filter((t) => t.status === "OPEN" || t.status === "DELAYED").length;
    const overdueTasks = allTasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const dueTodayTasks = allTasks.filter((t) => isDueToday(t.dueDate, t.status)).length;

    const doneTasks = allTasks.filter((t) => t.status === "DONE");
    const onTimeDone = doneTasks.filter((t) => t.closedAt && t.dueDate && !isBefore(t.dueDate, t.closedAt)).length;
    const onTimeClosureRate = doneTasks.length > 0 ? Math.round((onTimeDone / doneTasks.length) * 100) : 0;

    // ── Pulse Zones ────────────────────────────────────────────────────

    const needsYouNow: PulseTask[] = [];
    const watchList: PulseTask[] = [];
    const zombieTasks: ZombieTask[] = [];
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    for (const t of allTasks) {
      if (t.status === "DONE") continue;

      const daysOverdue = t.dueDate
        ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const lastActivity = lastActivityMap[t.id];
      const daysSinceActivity = lastActivity
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const delays = delayCountMap[t.id] || 0;
      const silent = !repliedTaskIds.has(t.id);

      // Needs You Now: overdue 7+ days silent, delayed 3+ times, escalation needed
      if (isOverdue(t.dueDate, t.status) && silent && daysOverdue >= 7) {
        needsYouNow.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `${daysOverdue}d overdue — no response from owner`,
          urgency: daysOverdue >= 14 ? "critical" : "high",
        });
      } else if (delays >= 3) {
        needsYouNow.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `Delayed ${delays} times — needs your decision`,
          urgency: "high",
        });
      } else if (isOverdue(t.dueDate, t.status) && daysOverdue >= 3 && t.escalationLevel < 1) {
        needsYouNow.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `${daysOverdue}d overdue — escalation pending`,
          urgency: "high",
        });
      }
      // Zombie tasks: no activity in 21+ days
      else if (daysSinceActivity >= 21) {
        zombieTasks.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          daysSinceActivity,
        });
      }
      // Watch List: due in 3 days with no activity in 5 days, or delayed once/twice
      else if (t.dueDate && t.dueDate <= in3Days && !isOverdue(t.dueDate, t.status) && daysSinceActivity >= 5) {
        watchList.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `Due ${t.dueDate <= new Date() ? "today" : "in " + Math.ceil((t.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + " days"} — no update in ${daysSinceActivity}d`,
          urgency: "medium",
        });
      } else if (delays >= 1 && delays < 3) {
        watchList.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `Delayed ${delays} time${delays > 1 ? "s" : ""} — watch closely`,
          urgency: "medium",
        });
      }
    }

    // Deduplicate by task id
    const seen = new Set<string>();
    const dedup = (arr: PulseTask[]) => arr.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
    const needsYouNowFinal = dedup(needsYouNow).slice(0, 8);
    seen.clear();
    const watchListFinal = dedup(watchList.filter((t) => !needsYouNow.find((n) => n.id === t.id))).slice(0, 6);

    const runningFineCount = allTasks.filter((t) => {
      if (t.status === "DONE" || t.status !== "OPEN") return false;
      return !needsYouNow.find((n) => n.id === t.id) && !watchList.find((w) => w.id === t.id) && !zombieTasks.find((z) => z.id === t.id);
    }).length;

    // Top line AI summary
    const topLine = needsYouNowFinal.length > 0
      ? `${needsYouNowFinal.length} item${needsYouNowFinal.length > 1 ? "s" : ""} need your decision today. ${zombieTasks.length > 0 ? `${zombieTasks.length} zombie task${zombieTasks.length > 1 ? "s" : ""} need cleanup.` : ""}`
      : watchListFinal.length > 0
      ? `No critical blockers. ${watchListFinal.length} item${watchListFinal.length > 1 ? "s" : ""} to watch this week.`
      : `Clean execution day. ${runningFineCount} task${runningFineCount !== 1 ? "s" : ""} running on track.`;

    // Owner stats
    const ownerMap: Record<string, { function: string; tasks: typeof allTasks }> = {};
    for (const task of allTasks) {
      if (!ownerMap[task.owner]) ownerMap[task.owner] = { function: task.function, tasks: [] };
      ownerMap[task.owner].tasks.push(task);
    }

    const ownerStats = Object.entries(ownerMap).map(([owner, data]) => {
      const tasks = data.tasks;
      const done = tasks.filter((t) => t.status === "DONE").length;
      const overdueCount = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
      const delayed = tasks.filter((t) => t.status === "DELAYED").length;
      const open = tasks.filter((t) => t.status === "OPEN").length;
      const closureRate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      const executionScore = tasks.length > 0
        ? Math.max(0, Math.min(100, Math.round((done / tasks.length) * 100 - (overdueCount / tasks.length) * 30)))
        : 0;
      return { owner, function: data.function, total: tasks.length, open, done, overdue: overdueCount, delayed, closureRate, executionScore };
    }).sort((a, b) => b.total - a.total);

    const overdueTasksSummary = allTasks
      .filter((t) => isOverdue(t.dueDate, t.status))
      .sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return a.dueDate.getTime() - b.dueDate.getTime(); })
      .slice(0, 10);

    const dueSoonSummary = allTasks
      .filter((t) => { if (t.status === "DONE" || !t.dueDate) return false; if (isOverdue(t.dueDate, t.status)) return false; if (isToday(t.dueDate)) return false; return t.dueDate <= in3Days; })
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 5);

    const recentTasks = allTasks.slice(0, 8);

    const needsEscalation = allTasks
      .filter((t) => { if (t.status === "DONE" || !t.dueDate) return false; const daysOverdue = Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24)); return daysOverdue >= 3 && t.escalationLevel < 1; })
      .slice(0, 6);

    const silentOverdue = allTasks
      .filter((t) => { if (t.status === "DONE" || !t.dueDate) return false; if (!isOverdue(t.dueDate, t.status)) return false; return !repliedTaskIds.has(t.id); })
      .sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return a.dueDate.getTime() - b.dueDate.getTime(); })
      .slice(0, 6);

    const recentReminders = await prisma.reminder.findMany({
      where: { type: { not: "INBOUND_REPLY" } },
      orderBy: { sentAt: "desc" },
      take: 8,
      include: { task: { select: { title: true, owner: true } } },
    });

    return NextResponse.json({
      totalOpenTasks, overdueTasks, dueTodayTasks, onTimeClosureRate,
      ownerStats, recentTasks, overdueTasksSummary, dueSoonSummary,
      needsEscalation, silentOverdue, recentReminders,
      needsYouNow: needsYouNowFinal,
      watchList: watchListFinal,
      zombieTasks: zombieTasks.slice(0, 8),
      runningFineCount,
      topLine,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
