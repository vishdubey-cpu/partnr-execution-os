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
    const allTasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });

    const overdueTasks = allTasks.filter((t) => isOverdue(t.dueDate, t.status));
    const dueTodayTasks = allTasks.filter((t) => t.status !== "DONE" && !!t.dueDate && isToday(t.dueDate));

    // Silent overdue: overdue tasks with no inbound reply
    const inboundReplies = await prisma.reminder.findMany({
      where: { type: "INBOUND_REPLY" },
      select: { taskId: true },
    });
    const repliedTaskIds = new Set(inboundReplies.map((r) => r.taskId));

    const silentOverdue = overdueTasks
      .filter((t) => !repliedTaskIds.has(t.id))
      .sort((a, b) => (a.dueDate && b.dueDate ? a.dueDate.getTime() - b.dueDate.getTime() : 0))
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        owner: t.owner,
        daysOverdue: t.dueDate
          ? Math.floor((Date.now() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      }));

    // Worst owner: most overdue tasks
    const ownerOverdueCount: Record<string, number> = {};
    for (const t of overdueTasks) {
      ownerOverdueCount[t.owner] = (ownerOverdueCount[t.owner] || 0) + 1;
    }
    const worstOwnerEntry = Object.entries(ownerOverdueCount).sort((a, b) => b[1] - a[1])[0];
    const worstOwner = worstOwnerEntry && worstOwnerEntry[1] >= 2
      ? { owner: worstOwnerEntry[0], overdueCount: worstOwnerEntry[1] }
      : undefined;

    await sendDailyDigest(adminEmail, adminName, {
      overdueCount: overdueTasks.length,
      dueTodayCount: dueTodayTasks.length,
      silentOverdue,
      dueTodayTasks: dueTodayTasks.slice(0, 3).map((t) => ({ id: t.id, title: t.title, owner: t.owner })),
      worstOwner,
    });

    return NextResponse.json({
      sent: true,
      to: adminEmail,
      silentOverdue: silentOverdue.length,
      dueToday: dueTodayTasks.length,
      worstOwner: worstOwner?.owner || null,
    });
  } catch (err) {
    console.error("[daily-digest] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
