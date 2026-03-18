import { prisma } from "@/lib/prisma";
import { isBefore, startOfWeek, endOfWeek } from "date-fns";
import { buildWeeklySummaryMessage } from "@/lib/whatsapp";
import { getDaysOverdue } from "@/lib/utils";

export interface WeeklySummaryReport {
  periodStart: string;
  periodEnd: string;
  summary: {
    totalTasks: number;
    tasksCreatedThisWeek: number;
    tasksClosedThisWeek: number;
    overdueTasks: number;
    onTimeClosureRate: number;
    escalationsThisWeek: number;
  };
  pendingDecisionsLog: Array<{
    id: string;
    title: string;
    owner: string;
    function: string;
    dueDate: string;
    status: string;
    daysOverdue: number;
  }>;
  overdueActionSummary: {
    one_to_three_days: Array<{ id: string; title: string; owner: string; daysOverdue: number }>;
    four_to_seven_days: Array<{ id: string; title: string; owner: string; daysOverdue: number }>;
    over_seven_days: Array<{ id: string; title: string; owner: string; daysOverdue: number }>;
  };
  ownerWiseClosureRates: Array<{
    owner: string;
    function: string;
    assigned: number;
    closed: number;
    onTimePercent: number;
    overduePercent: number;
  }>;
  topPerformers: Array<{ owner: string; function: string; closureRate: number; done: number; total: number }>;
  attentionNeededOwners: Array<{ owner: string; function: string; overdue: number; closureRate: number }>;
  whatsappSummaryText: string;
}

export async function generateWeeklySummary(): Promise<WeeklySummaryReport> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const allTasks = await prisma.task.findMany();

  // ── Core counts ────────────────────────────────────────────────
  const createdThisWeek = allTasks.filter(
    (t) => new Date(t.createdAt) >= weekStart && new Date(t.createdAt) <= weekEnd
  );
  const closedThisWeek = allTasks.filter(
    (t) => t.status === "DONE" && t.closedAt && new Date(t.closedAt) >= weekStart && new Date(t.closedAt) <= weekEnd
  );
  const overdueTasks = allTasks.filter(
    (t) => t.status !== "DONE" && !!t.dueDate && isBefore(t.dueDate, now)
  );
  const doneTasks = allTasks.filter((t) => t.status === "DONE");
  const onTimeDone = doneTasks.filter(
    (t) => t.closedAt && !!t.dueDate && !isBefore(t.dueDate, new Date(t.closedAt))
  ).length;
  const onTimeClosureRate = doneTasks.length > 0 ? Math.round((onTimeDone / doneTasks.length) * 100) : 0;

  // Escalations this week
  const escalationsThisWeek = await prisma.activity.count({
    where: {
      type: "ESCALATION",
      createdAt: { gte: weekStart, lte: weekEnd },
    },
  });

  // ── Pending decisions (open + delayed, sorted by due date) ─────
  const pendingDecisionsLog = allTasks
    .filter((t) => t.status === "OPEN" || t.status === "DELAYED" || t.status === "OVERDUE")
    .sort((a, b) => {
      const aTime = a.dueDate ? a.dueDate.getTime() : Infinity;
      const bTime = b.dueDate ? b.dueDate.getTime() : Infinity;
      return aTime - bTime;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      owner: t.owner,
      function: t.function,
      dueDate: t.dueDate?.toISOString() ?? "",
      status: t.status,
      daysOverdue: getDaysOverdue(t.dueDate ?? undefined),
    }));

  // ── Overdue bucketed ──────────────────────────────────────────
  const overdueEnriched = overdueTasks.map((t) => ({
    id: t.id,
    title: t.title,
    owner: t.owner,
    daysOverdue: getDaysOverdue(t.dueDate),
  }));

  const overdueActionSummary = {
    one_to_three_days: overdueEnriched.filter((t) => t.daysOverdue >= 1 && t.daysOverdue <= 3),
    four_to_seven_days: overdueEnriched.filter((t) => t.daysOverdue >= 4 && t.daysOverdue <= 7),
    over_seven_days: overdueEnriched.filter((t) => t.daysOverdue > 7),
  };

  // ── Owner stats ───────────────────────────────────────────────
  const ownerMap: Record<string, { fn: string; tasks: typeof allTasks }> = {};
  for (const t of allTasks) {
    if (!ownerMap[t.owner]) ownerMap[t.owner] = { fn: t.function, tasks: [] };
    ownerMap[t.owner].tasks.push(t);
  }

  const ownerWiseClosureRates = Object.entries(ownerMap).map(([owner, { fn, tasks }]) => {
    const closed = tasks.filter((t) => t.status === "DONE").length;
    const overdue = tasks.filter((t) => t.status !== "DONE" && !!t.dueDate && isBefore(t.dueDate, now)).length;
    const onTime = tasks.filter(
      (t) => t.status === "DONE" && t.closedAt && !!t.dueDate && !isBefore(t.dueDate, new Date(t.closedAt))
    ).length;
    return {
      owner,
      function: fn,
      assigned: tasks.length,
      closed,
      onTimePercent: closed > 0 ? Math.round((onTime / closed) * 100) : 0,
      overduePercent: tasks.length > 0 ? Math.round((overdue / tasks.length) * 100) : 0,
    };
  });

  const topPerformers = ownerWiseClosureRates
    .filter((o) => o.closed > 0)
    .map((o) => ({
      owner: o.owner,
      function: o.function,
      closureRate: Math.round((o.closed / o.assigned) * 100),
      done: o.closed,
      total: o.assigned,
    }))
    .sort((a, b) => b.closureRate - a.closureRate)
    .slice(0, 5);

  const attentionNeededOwners = ownerWiseClosureRates
    .map((o) => ({
      owner: o.owner,
      function: o.function,
      overdue: Math.round((o.overduePercent / 100) * o.assigned),
      closureRate: Math.round((o.closed / o.assigned) * 100),
    }))
    .filter((o) => o.overdue > 0 || o.closureRate < 50)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 6);

  // ── WhatsApp text ─────────────────────────────────────────────
  const whatsappSummaryText = buildWeeklySummaryMessage({
    periodStart: weekStart.toISOString(),
    periodEnd: weekEnd.toISOString(),
    tasksCreated: createdThisWeek.length,
    tasksClosed: closedThisWeek.length,
    overdueCount: overdueTasks.length,
    onTimeClosureRate,
    topPerformers,
    attentionNeeded: attentionNeededOwners,
    pendingDecisions: pendingDecisionsLog.slice(0, 5),
  });

  return {
    periodStart: weekStart.toISOString(),
    periodEnd: weekEnd.toISOString(),
    summary: {
      totalTasks: allTasks.length,
      tasksCreatedThisWeek: createdThisWeek.length,
      tasksClosedThisWeek: closedThisWeek.length,
      overdueTasks: overdueTasks.length,
      onTimeClosureRate,
      escalationsThisWeek,
    },
    pendingDecisionsLog,
    overdueActionSummary,
    ownerWiseClosureRates,
    topPerformers,
    attentionNeededOwners,
    whatsappSummaryText,
  };
}
