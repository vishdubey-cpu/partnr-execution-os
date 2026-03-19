import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function GET() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME || "Admin";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!adminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL not set" }, { status: 400 });
  }

  try {
    const now = new Date();

    const allTasks = await prisma.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: { createdAt: "asc" },
    });

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

    // Zombie: no activity in 21+ days
    const zombieTasks = allTasks.filter((t) => {
      const last = lastActivityMap[t.id];
      const days = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return days >= 21;
    });

    // Repeat delayers: 3+ delays
    const repeatDelayers = allTasks.filter((t) => (delayCountMap[t.id] || 0) >= 3)
      .filter((t) => !zombieTasks.find((z) => z.id === t.id));

    // Stale open: open for 14+ days, no activity in 10 days
    const staleTasks = allTasks.filter((t) => {
      const ageInDays = Math.floor((now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const last = lastActivityMap[t.id];
      const daysSince = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return ageInDays >= 14 && daysSince >= 10 && !zombieTasks.find((z) => z.id === t.id);
    }).slice(0, 5);

    if (zombieTasks.length === 0 && repeatDelayers.length === 0 && staleTasks.length === 0) {
      return NextResponse.json({ sent: false, reason: "Nothing to groom — all tasks are healthy" });
    }

    const zombieRows = zombieTasks.slice(0, 6).map((t) => {
      const last = lastActivityMap[t.id];
      const days = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;">
          <a href="${baseUrl}/tasks/${t.id}" style="color:#111;text-decoration:none;font-size:13px;font-weight:500;">${t.title}</a>
        </td>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px;color:#555;">${t.owner}</td>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:12px;color:#9CA3AF;">${days}d silent</td>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;">
          <a href="${baseUrl}/tasks/${t.id}" style="font-size:11px;color:#4F46E5;font-weight:600;">Review →</a>
        </td>
      </tr>`;
    }).join("");

    const delayRows = repeatDelayers.slice(0, 4).map((t) => {
      const delays = delayCountMap[t.id] || 0;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #FDE68A;">
          <a href="${baseUrl}/tasks/${t.id}" style="color:#111;text-decoration:none;font-size:13px;font-weight:500;">${t.title}</a>
        </td>
        <td style="padding:8px;border-bottom:1px solid #FDE68A;font-size:12px;color:#555;">${t.owner}</td>
        <td style="padding:8px;border-bottom:1px solid #FDE68A;font-size:12px;color:#B45309;font-weight:600;">${delays}x delayed</td>
        <td style="padding:8px;border-bottom:1px solid #FDE68A;">
          <a href="${baseUrl}/tasks/${t.id}" style="font-size:11px;color:#4F46E5;font-weight:600;">Decide →</a>
        </td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:620px;margin:0 auto;padding:32px 24px;color:#111;">
        <h2 style="font-size:20px;font-weight:700;margin:0 0 4px;">Weekly Execution Clean-Up</h2>
        <p style="font-size:13px;color:#888;margin:0 0 28px;">Good Sunday, ${adminName}. Here's what needs a decision before Monday.</p>

        ${zombieTasks.length > 0 ? `
        <div style="margin-bottom:24px;">
          <p style="font-size:13px;font-weight:700;color:#374151;margin:0 0 8px;">🧟 ${zombieTasks.length} Zombie Task${zombieTasks.length > 1 ? "s" : ""} — No activity in 21+ days</p>
          <p style="font-size:12px;color:#9CA3AF;margin:0 0 10px;">These are dead weight. Close, reassign, or break them into smaller tasks.</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            <thead><tr style="background:#F9FAFB;">
              <th style="text-align:left;font-size:11px;color:#888;padding:8px;font-weight:600;">TASK</th>
              <th style="text-align:left;font-size:11px;color:#888;padding:8px;font-weight:600;">OWNER</th>
              <th style="text-align:left;font-size:11px;color:#888;padding:8px;font-weight:600;">SILENT FOR</th>
              <th style="padding:8px;"></th>
            </tr></thead>
            <tbody>${zombieRows}</tbody>
          </table>
        </div>` : ""}

        ${repeatDelayers.length > 0 ? `
        <div style="margin-bottom:24px;">
          <p style="font-size:13px;font-weight:700;color:#B45309;margin:0 0 8px;">🔄 ${repeatDelayers.length} Repeat Delayer${repeatDelayers.length > 1 ? "s" : ""} — Delayed 3+ times</p>
          <p style="font-size:12px;color:#9CA3AF;margin:0 0 10px;">These tasks keep getting pushed. They need a hard decision — not another date.</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #FDE68A;border-radius:8px;overflow:hidden;">
            <thead><tr style="background:#FFFBEB;">
              <th style="text-align:left;font-size:11px;color:#888;padding:8px;font-weight:600;">TASK</th>
              <th style="text-align:left;font-size:11px;color:#888;padding:8px;font-weight:600;">OWNER</th>
              <th style="text-align:left;font-size:11px;color:#888;padding:8px;font-weight:600;">PATTERN</th>
              <th style="padding:8px;"></th>
            </tr></thead>
            <tbody>${delayRows}</tbody>
          </table>
        </div>` : ""}

        <p style="font-size:12px;color:#9CA3AF;border-top:1px solid #F3F4F6;padding-top:20px;margin-top:8px;">
          Tip: For each zombie task — open it, decide: Close it / Reassign to someone who will act / Break it into smaller tasks.
        </p>

        <p style="margin-top:20px;">
          <a href="${baseUrl}/tasks" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
            Open Task List →
          </a>
        </p>

        <p style="font-size:11px;color:#aaa;margin-top:32px;">Partnr Execution OS · Weekly Grooming</p>
      </div>`;

    const subject = `🧹 Weekly clean-up: ${zombieTasks.length + repeatDelayers.length} tasks need a decision`;

    await sendEmail({ to: adminEmail, subject, html });

    return NextResponse.json({
      sent: true,
      zombieTasks: zombieTasks.length,
      repeatDelayers: repeatDelayers.length,
      staleTasks: staleTasks.length,
    });
  } catch (err) {
    console.error("[grooming] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
