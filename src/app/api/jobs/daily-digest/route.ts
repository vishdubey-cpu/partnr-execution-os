import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDailyDigest } from "@/lib/email";
import { isBefore, isToday } from "date-fns";

const isOverdue = (dueDate: Date | null, status: string) =>
  status === "OVERDUE" || (status !== "DONE" && !!dueDate && isBefore(dueDate, new Date()));

export async function GET() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME || "Admin";

  if (!adminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL env var not set" }, { status: 400 });
  }

  try {
    const now = new Date();
    const allTasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });

    // Activity tracking
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

    const overdueTasks = allTasks.filter((t) => isOverdue(t.dueDate, t.status));
    const dueTodayTasks = allTasks.filter((t) => t.status !== "DONE" && !!t.dueDate && isToday(t.dueDate));
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Needs decision: overdue 7+ days silent, or 3x delayed
    const needsDecision = allTasks
      .filter((t) => {
        if (t.status === "DONE") return false;
        const daysOverdue = t.dueDate ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const silent = !repliedTaskIds.has(t.id);
        const delays = delayCountMap[t.id] || 0;
        return (isOverdue(t.dueDate, t.status) && silent && daysOverdue >= 5) || delays >= 3;
      })
      .slice(0, 3)
      .map((t) => {
        const delays = delayCountMap[t.id] || 0;
        const daysOverdue = t.dueDate ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          id: t.id,
          title: t.title,
          owner: t.owner,
          reason: delays >= 3 ? `Delayed ${delays} times` : `${daysOverdue}d overdue, no response`,
        };
      });

    // Drifting: due in 3 days, no activity in 5 days
    const drifting = allTasks
      .filter((t) => {
        if (t.status === "DONE" || !t.dueDate) return false;
        if (isOverdue(t.dueDate, t.status)) return false;
        const last = lastActivityMap[t.id];
        const daysSince = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        return t.dueDate <= in3Days && daysSince >= 5;
      })
      .slice(0, 3)
      .map((t) => {
        const daysUntil = t.dueDate ? Math.ceil((t.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return { id: t.id, title: t.title, owner: t.owner, daysUntil };
      });

    // People insight: per owner
    const ownerMap: Record<string, { delays: number; overdue: number; noResponse: number }> = {};
    for (const t of allTasks) {
      if (!ownerMap[t.owner]) ownerMap[t.owner] = { delays: 0, overdue: 0, noResponse: 0 };
      if (delayCountMap[t.id] >= 1) ownerMap[t.owner].delays++;
      if (isOverdue(t.dueDate, t.status)) ownerMap[t.owner].overdue++;
      if (isOverdue(t.dueDate, t.status) && !repliedTaskIds.has(t.id)) ownerMap[t.owner].noResponse++;
    }

    const peopleInsight = Object.entries(ownerMap)
      .filter(([, v]) => v.overdue > 0 || v.delays > 1)
      .sort((a, b) => (b[1].overdue + b[1].delays) - (a[1].overdue + a[1].delays))
      .slice(0, 4)
      .map(([owner, v]) => ({ owner, ...v }));

    // Done recently (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentlyDone = allTasks
      .filter((t) => t.status === "DONE" && t.closedAt && t.closedAt >= sevenDaysAgo)
      .slice(0, 4)
      .map((t) => ({ id: t.id, title: t.title, owner: t.owner }));

    // Execution pulse
    const activeTasks = allTasks.filter((t) => t.status !== "DONE");
    const onTimeDoneThisWeek = allTasks.filter((t) =>
      t.status === "DONE" && t.closedAt && t.closedAt >= sevenDaysAgo &&
      t.dueDate && !isBefore(t.dueDate, t.closedAt)
    ).length;

    await sendDailyDigest(adminEmail, adminName, {
      overdueCount: overdueTasks.length,
      dueTodayCount: dueTodayTasks.length,
      silentOverdue: overdueTasks
        .filter((t) => !repliedTaskIds.has(t.id))
        .slice(0, 6)
        .map((t) => ({ id: t.id, title: t.title, owner: t.owner, daysOverdue: t.dueDate ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0 })),
      dueTodayTasks: dueTodayTasks.slice(0, 3).map((t) => ({ id: t.id, title: t.title, owner: t.owner })),
      worstOwner: undefined,
      // New fields
      needsDecision,
      drifting,
      peopleInsight,
      recentlyDone,
      executionPulse: {
        active: activeTasks.length,
        dueThisWeek: allTasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate <= in3Days).length,
        completedOnTime: onTimeDoneThisWeek,
        delayed: allTasks.filter((t) => t.status === "DELAYED").length,
        noResponse: overdueTasks.filter((t) => !repliedTaskIds.has(t.id)).length,
      },
    });

    return NextResponse.json({ sent: true, to: adminEmail, needsDecision: needsDecision.length, drifting: drifting.length });
  } catch (err) {
    console.error("[daily-digest] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
