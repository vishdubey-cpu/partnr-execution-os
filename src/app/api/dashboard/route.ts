import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isToday, isBefore } from "date-fns";
import type { PulseTask, ZombieTask, PersonReliability } from "@/types";

function getSeverityTag(daysOverdue: number, delays: number, status: string): PulseTask["severityTag"] {
  if (status === "BLOCKED") return "BLOCKED";
  if (delays >= 3) return "ESCALATED";
  if (delays >= 1) return "REPEATED_DELAY";
  return "CRITICAL";
}

function getSituation(owner: string, daysOverdue: number, delays: number, silent: boolean): string {
  if (delays >= 3) {
    return `${owner} has delayed this ${delays} times. The task is ${daysOverdue > 0 ? `${daysOverdue} days past due` : "still open"} with no clear plan forward.`;
  }
  if (silent && daysOverdue >= 7) {
    return `No update has come in from ${owner} for ${daysOverdue} days. The task is overdue and unacknowledged.`;
  }
  if (daysOverdue >= 3) {
    return `This task is ${daysOverdue} days overdue. ${owner} has not provided an updated timeline.`;
  }
  return `This item requires a decision. ${owner} is the assigned owner and has not responded.`;
}

function getWhyItMatters(priority: string, func: string, daysOverdue: number): string {
  if (priority === "CRITICAL") return "This is a critical priority item. Delay has cascading impact on the team.";
  if (func === "HR" || func === "People") return "May affect hiring targets or people-related commitments.";
  if (func === "Finance") return "Financial or budget decisions downstream may be affected.";
  if (func === "Operations") return "Operational execution depends on this being resolved.";
  if (func === "Sales") return "Sales pipeline or revenue commitments may be at risk.";
  if (daysOverdue >= 14) return "Extended overdue period suggests a systemic blocker, not just a delay.";
  return "Continued delay affects team delivery commitments.";
}

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
          severityTag: getSeverityTag(daysOverdue, delays, t.status),
          situation: getSituation(t.owner, daysOverdue, delays, silent),
          whyItMatters: getWhyItMatters(t.priority, t.function, daysOverdue),
        });
      } else if (delays >= 3) {
        needsYouNow.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `Delayed ${delays} times — needs your decision`,
          urgency: "high",
          severityTag: "ESCALATED",
          situation: getSituation(t.owner, daysOverdue, delays, silent),
          whyItMatters: getWhyItMatters(t.priority, t.function, daysOverdue),
        });
      } else if (isOverdue(t.dueDate, t.status) && daysOverdue >= 3 && t.escalationLevel < 1) {
        needsYouNow.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `${daysOverdue}d overdue — escalation pending`,
          urgency: "high",
          severityTag: getSeverityTag(daysOverdue, delays, t.status),
          situation: getSituation(t.owner, daysOverdue, delays, silent),
          whyItMatters: getWhyItMatters(t.priority, t.function, daysOverdue),
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
        const daysUntil = Math.ceil((t.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        watchList.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `Due ${daysUntil <= 0 ? "today" : `in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`} — no update in ${daysSinceActivity}d`,
          urgency: "medium",
          severityTag: "REPEATED_DELAY",
          situation: `${t.owner} has not logged any update in ${daysSinceActivity} days. Due date is approaching.`,
        });
      } else if (delays >= 1 && delays < 3) {
        watchList.push({
          id: t.id, title: t.title, owner: t.owner,
          dueDate: t.dueDate?.toISOString() ?? null,
          reason: `Delayed ${delays} time${delays > 1 ? "s" : ""} — watch closely`,
          urgency: "medium",
          severityTag: "REPEATED_DELAY",
          situation: `${t.owner} has delayed this ${delays} time${delays > 1 ? "s" : ""}. Progress signals are weak.`,
        });
      }
    }

    // Deduplicate by task id
    const seen = new Set<string>();
    const dedup = (arr: PulseTask[]) => arr.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
    const needsYouNowFinal = dedup(needsYouNow).slice(0, 3); // hard cap at 3
    seen.clear();
    const watchListFinal = dedup(watchList.filter((t) => !needsYouNow.find((n) => n.id === t.id))).slice(0, 5);

    const runningFineCount = allTasks.filter((t) => {
      if (t.status === "DONE" || t.status !== "OPEN") return false;
      return !needsYouNow.find((n) => n.id === t.id) && !watchList.find((w) => w.id === t.id) && !zombieTasks.find((z) => z.id === t.id);
    }).length;

    // ── Headline state ─────────────────────────────────────────────────
    const hasCritical = needsYouNowFinal.some((t) => t.urgency === "critical");
    const headlineState: "calm" | "watchful" | "bad" | "critical" =
      hasCritical || needsYouNowFinal.length >= 3 ? "critical"
      : needsYouNowFinal.length >= 1 ? "bad"
      : watchListFinal.length >= 1 ? "watchful"
      : "calm";

    // ── People reliability ─────────────────────────────────────────────
    const ownerReliabilityMap: Record<string, {
      function: string; activeTasks: number; delayed: number; silent: number;
      doneTasks: number; onTimeDone: number;
    }> = {};

    for (const t of allTasks) {
      if (!ownerReliabilityMap[t.owner]) {
        ownerReliabilityMap[t.owner] = { function: t.function, activeTasks: 0, delayed: 0, silent: 0, doneTasks: 0, onTimeDone: 0 };
      }
      const o = ownerReliabilityMap[t.owner];
      if (t.status !== "DONE") o.activeTasks++;
      if ((delayCountMap[t.id] || 0) >= 1) o.delayed++;
      if (isOverdue(t.dueDate, t.status) && !repliedTaskIds.has(t.id)) o.silent++;
      if (t.status === "DONE") {
        o.doneTasks++;
        if (t.closedAt && t.dueDate && !isBefore(t.dueDate, t.closedAt)) o.onTimeDone++;
      }
    }

    const peopleReliability: PersonReliability[] = Object.entries(ownerReliabilityMap)
      .filter(([, v]) => v.activeTasks + v.doneTasks >= 2)
      .map(([owner, v]) => {
        const onTimeRate = v.doneTasks > 0 ? Math.round((v.onTimeDone / v.doneTasks) * 100) : 0;
        const reliabilityLabel: PersonReliability["reliabilityLabel"] =
          v.silent >= 2 || v.delayed >= 3 || (v.doneTasks > 0 && onTimeRate < 40) ? "AT_RISK"
          : v.silent >= 1 || v.delayed >= 1 || (v.doneTasks > 0 && onTimeRate < 70) ? "WATCH"
          : "STRONG";

        let patternInsight: string;
        if (v.delayed >= 3) {
          patternInsight = `Repeated postponement — ${v.delayed} tasks delayed. Pattern is consistent.`;
        } else if (v.silent >= 2) {
          patternInsight = `Tasks go overdue without status updates. ${v.silent} open items with no response.`;
        } else if (v.delayed >= 1 && v.silent >= 1) {
          patternInsight = `Mix of delays and silence. Execution is inconsistent this cycle.`;
        } else if (onTimeRate >= 80 && v.delayed === 0 && v.silent === 0) {
          patternInsight = `Consistently closes tasks on time. High execution reliability.`;
        } else if (reliabilityLabel === "STRONG") {
          patternInsight = `Steady execution with no major flags this period.`;
        } else {
          patternInsight = `Some delays on open items. Worth a check-in this week.`;
        }

        const suggestedAction =
          reliabilityLabel === "AT_RISK" ? "Review workload or escalate pending items directly."
          : reliabilityLabel === "WATCH" ? "Ask for a status update on open items."
          : undefined;

        return { owner, function: v.function, reliabilityLabel, activeTasks: v.activeTasks, onTimeRate, delayed: v.delayed, silent: v.silent, patternInsight, suggestedAction };
      })
      .sort((a, b) => {
        const rank = { AT_RISK: 0, WATCH: 1, STRONG: 2 };
        return rank[a.reliabilityLabel] - rank[b.reliabilityLabel];
      })
      .slice(0, 5);

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
      headlineState,
      peopleReliability,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
