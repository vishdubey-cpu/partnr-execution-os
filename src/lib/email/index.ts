/**
 * Email Notification Provider
 * - EMAIL_PROVIDER=GMAIL  → sends via Gmail SMTP (needs GMAIL_USER + GMAIL_APP_PASSWORD)
 * - EMAIL_PROVIDER=RESEND → sends via Resend HTTP API (needs RESEND_API_KEY)
 * - Otherwise             → mock (logs to console only)
 */

import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

// Returns array of Chief of Staff emails from env var
function getCoSEmails(): string[] {
  const raw = process.env.CHIEF_OF_STAFF_EMAILS || "";
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

// Sends email to primary recipient + CC to all CoS
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  ccList?: string[];
}): Promise<void> {
  const cc = opts.ccList ?? getCoSEmails();
  const emailProvider = process.env.EMAIL_PROVIDER?.toUpperCase();
  const provider =
    emailProvider === "GMAIL" && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
      ? "GMAIL"
      : emailProvider === "RESEND" && process.env.RESEND_API_KEY
      ? "RESEND"
      : "MOCK";

  if (provider === "GMAIL") {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `Partnr Reminders <${process.env.GMAIL_USER}>`,
      to: opts.to,
      cc: cc.length ? cc.join(",") : undefined,
      subject: opts.subject,
      html: opts.html,
    });
  } else if (provider === "RESEND") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Partnr OS <noreply@partnr.app>",
        to: opts.to,
        ...(cc.length ? { cc } : {}),
        subject: opts.subject,
        html: opts.html,
        options: { click_tracking: false, open_tracking: false },
      }),
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Resend API ${res.status}: ${JSON.stringify(resBody)}`);
    }
    console.log(`[Email RESEND] Accepted | id=${resBody.id} | to=${opts.to} | subject="${opts.subject}"`);
  } else {
    console.log(`[Email MOCK] To: ${opts.to}${cc.length ? ` | CC: ${cc.join(", ")}` : ""} | Subject: ${opts.subject}`);
  }
}

export type EmailReminderType =
  | "task_assigned"
  | "due_in_2_days"
  | "due_today"
  | "overdue_1_day"
  | "escalated_to_manager"
  | "escalated_to_admin"
  | "escalated_owner_notice"
  | "midpoint_check"
  | "silence_check";

interface TaskData {
  id: string;
  title: string;
  owner: string;
  dueDate: Date | string;
  source?: string | null;
}

// ── Templates ─────────────────────────────────────────────────────────

function buildSubject(type: EmailReminderType, taskData: TaskData): string {
  const due = taskData.dueDate
    ? new Date(taskData.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";
  switch (type) {
    case "task_assigned":    return `Action Required: ${taskData.title}`;
    case "due_in_2_days":    return `Reminder: "${taskData.title}" is due in 2 days`;
    case "due_today":        return `Due Today: "${taskData.title}"`;
    case "overdue_1_day":    return `Overdue: "${taskData.title}" was due ${due}`;
    case "escalated_to_manager":     return `Escalation: Task overdue — ${taskData.title}`;
    case "escalated_to_admin":       return `[Admin] Task escalated: ${taskData.title}`;
    case "escalated_owner_notice":   return `⚠️ Your task has been escalated: "${taskData.title}"`;
    case "midpoint_check":       return `Midpoint check-in: "${taskData.title}" — how's it going?`;
    case "silence_check":        return `⚠️ No update received: "${taskData.title}" is due soon`;
  }
}

function buildBody(
  type: EmailReminderType,
  recipientName: string,
  taskData: TaskData,
  extra?: Record<string, string>
): string {
  const due = taskData.dueDate
    ? new Date(taskData.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const taskUrl = `${baseUrl}/task-view/${taskData.id}`;
  const myTasksUrl = `${baseUrl}/my-tasks/${encodeURIComponent(taskData.owner)}`;

  const sourceBlock = taskData.source
    ? `<div style="background:#F8FAFC;border-left:3px solid #CBD5E1;padding:8px 12px;margin:12px 0;border-radius:0 4px 4px 0;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Context from meeting</p>
        <p style="margin:0;font-size:12px;color:#555;font-style:italic;">&ldquo;${taskData.source}&rdquo;</p>
       </div>`
    : "";

  const wrap = (content: string) => `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      ${content}
      ${sourceBlock}
      <p style="margin-top: 24px;">
        <a href="${taskUrl}" style="background: #4F46E5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-right: 12px;">
          Update this task →
        </a>
        <a href="${myTasksUrl}" style="color: #4F46E5; font-size: 13px; text-decoration: none;">
          View all your tasks
        </a>
      </p>
      <p style="margin-top: 32px; font-size: 12px; color: #888;">Partnr Execution OS</p>
    </div>`;

  switch (type) {
    case "task_assigned":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>A task has been assigned to you:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #555;">Due: <strong>${due}</strong></p>
        <p>Please confirm you've received this and update the status once done.</p>`);

    case "due_in_2_days":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>This is a reminder that your task is due in <strong>2 days</strong>:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #555;">Due: <strong>${due}</strong></p>`);

    case "due_today":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>Your task is <strong>due today</strong>:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p>Please complete it and mark it done.</p>`);

    case "overdue_1_day":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>Your task is <strong style="color: #DC2626;">overdue</strong>:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #DC2626;">Was due: ${due}</p>
        <p>Please update the status or provide a new timeline.</p>`);

    case "escalated_to_manager":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>The following task assigned to <strong>${taskData.owner}</strong> is overdue and has been escalated to you:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #DC2626;">Was due: ${due}</p>
        <p>Please follow up with ${taskData.owner} to resolve this.</p>`);

    case "escalated_to_admin":
      return wrap(`
        <p>Hi ${extra?.adminName || "Admin"},</p>
        <p>A task has been escalated to admin level (7+ days overdue):</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p>Owner: <strong>${taskData.owner}</strong><br/>Was due: ${due}</p>`);

    case "escalated_owner_notice":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>Your task has been <strong style="color: #DC2626;">escalated to your manager</strong> because it is ${extra?.daysOverdue || "3"}+ days overdue:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #DC2626;">Was due: ${due}</p>
        <p>Your manager has been notified. Please update the task status <strong>right now</strong> to prevent further escalation to senior leadership.</p>
        <p style="background: #FEF3C7; border-left: 3px solid #F59E0B; padding: 8px 12px; border-radius: 0 4px 4px 0; font-size: 13px; color: #92400E;">
          A quick update — even if delayed — shows accountability and stops the escalation chain.
        </p>`);

    case "midpoint_check":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>You're halfway to the deadline on this task:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #555;">Due: <strong>${due}</strong></p>
        <p>How is it going? Please click the link below to update your status — and if you're on track, tell us your next concrete step.</p>`);

    case "silence_check":
      return wrap(`
        <p>Hi ${recipientName},</p>
        <p>We haven't received an update on this task for a while, and it's due soon:</p>
        <p style="font-weight: 600; font-size: 16px;">${taskData.title}</p>
        <p style="color: #DC2626;">Due: <strong>${due}</strong></p>
        <p>Please click below to update your status — are you on track, blocked, or delayed?</p>`);
  }
}

// ── Daily Digest ──────────────────────────────────────────────────────

interface DigestData {
  overdueCount: number;
  dueTodayCount: number;
  silentOverdue: { title: string; owner: string; daysOverdue: number; id: string }[];
  dueTodayTasks: { title: string; owner: string; id: string }[];
  worstOwner?: { owner: string; overdueCount: number };
  needsDecision?: { id: string; title: string; owner: string; reason: string }[];
  drifting?: { id: string; title: string; owner: string; daysUntil: number }[];
  peopleInsight?: { owner: string; delays: number; overdue: number; noResponse: number }[];
  recentlyDone?: { id: string; title: string; owner: string }[];
  executionPulse?: { active: number; dueThisWeek: number; completedOnTime: number; delayed: number; noResponse: number };
}

export async function sendDailyDigest(adminEmail: string, adminName: string, data: DigestData): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/dashboard`;
  const overdueUrl = `${baseUrl}/overdue`;

  const needsDecision = data.needsDecision ?? [];
  const drifting = data.drifting ?? [];
  const peopleInsight = data.peopleInsight ?? [];
  const recentlyDone = data.recentlyDone ?? [];
  const pulse = data.executionPulse;

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Determine overall status for header colour
  const isRed    = needsDecision.length > 0 || data.overdueCount >= 3;
  const isAmber  = !isRed && (drifting.length > 0 || data.overdueCount > 0);
  const headerBg = isRed ? "#FEF2F2" : isAmber ? "#FFFBEB" : "#F0FDF4";
  const headerBorder = isRed ? "#FECACA" : isAmber ? "#FDE68A" : "#BBF7D0";
  const statusDot = isRed ? "#DC2626" : isAmber ? "#F59E0B" : "#16A34A";
  const statusLabel = isRed ? "Attention Required" : isAmber ? "Watch Closely" : "Clean Execution";
  const statusColor = isRed ? "#DC2626" : isAmber ? "#B45309" : "#166534";

  const subject = needsDecision.length > 0
    ? `🔴 ${needsDecision.length} decision${needsDecision.length > 1 ? "s" : ""} need you today — Partnr Morning Brief`
    : drifting.length > 0
    ? `🟡 ${drifting.length} task${drifting.length > 1 ? "s" : ""} drifting — Partnr Morning Brief`
    : `✅ Clean execution today — Partnr Morning Brief`;

  // Scorecard pills
  const scorecardItems = pulse ? [
    { label: "Active", value: pulse.active, color: "#4F46E5", bg: "#EEF2FF" },
    { label: "Due This Week", value: pulse.dueThisWeek, color: "#B45309", bg: "#FFFBEB" },
    { label: "On Time", value: pulse.completedOnTime, color: "#16A34A", bg: "#F0FDF4" },
    { label: "Delayed", value: pulse.delayed, color: "#D97706", bg: "#FEF3C7" },
    { label: "No Response", value: pulse.noResponse, color: "#DC2626", bg: "#FEF2F2" },
  ] : [];

  const scorecardHtml = scorecardItems.length > 0 ? `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:6px;margin-bottom:20px;">
      <tr>
        ${scorecardItems.map(s => `
          <td style="background:${s.bg};border-radius:10px;padding:12px 8px;text-align:center;width:20%;">
            <div style="font-size:22px;font-weight:800;color:${s.color};line-height:1;">${s.value}</div>
            <div style="font-size:10px;color:#6B7280;margin-top:3px;font-weight:500;">${s.label}</div>
          </td>`).join("")}
      </tr>
    </table>` : "";

  // Decision cards — each with its own action button
  const decisionCards = needsDecision.map(t => `
    <div style="background:#FFF5F5;border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111;">${t.title}</p>
            <p style="margin:0;font-size:12px;color:#DC2626;font-weight:600;">${t.reason}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">Owner: ${t.owner}</p>
          </td>
          <td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:12px;">
            <a href="${baseUrl}/tasks/${t.id}" style="background:#DC2626;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700;display:inline-block;">
              Take Action →
            </a>
          </td>
        </tr>
      </table>
    </div>`).join("");

  // Drifting rows — each with its own view button
  const driftingCards = drifting.map(t => `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-left:4px solid #F59E0B;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td>
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#111;">${t.title}</p>
            <p style="margin:0;font-size:12px;color:#92400E;">${t.owner} · Due ${t.daysUntil <= 0 ? "today" : `in ${t.daysUntil}d`}</p>
          </td>
          <td style="text-align:right;white-space:nowrap;padding-left:12px;">
            <a href="${baseUrl}/tasks/${t.id}" style="color:#B45309;font-size:12px;font-weight:700;text-decoration:none;border:1px solid #FDE68A;border-radius:5px;padding:5px 12px;background:white;display:inline-block;">
              View →
            </a>
          </td>
        </tr>
      </table>
    </div>`).join("");

  // People insight — each with link to their tasks
  const peopleCards = peopleInsight.map(p => {
    const flags: string[] = [];
    if (p.overdue > 0) flags.push(`<span style="color:#DC2626;font-weight:700;">${p.overdue} overdue</span>`);
    if (p.delays > 1) flags.push(`<span style="color:#D97706;">${p.delays}× delayed</span>`);
    if (p.noResponse > 0) flags.push(`<span style="color:#7C3AED;">${p.noResponse} silent</span>`);
    const myTasksUrl = `${baseUrl}/my-tasks/${encodeURIComponent(p.owner)}`;
    return `
    <div style="background:#FAF5FF;border:1px solid #DDD6FE;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td>
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#111;">${p.owner}</p>
            <p style="margin:0;font-size:12px;">${flags.join(" &nbsp;·&nbsp; ")}</p>
          </td>
          <td style="text-align:right;white-space:nowrap;padding-left:12px;">
            <a href="${myTasksUrl}" style="color:#7C3AED;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #DDD6FE;border-radius:5px;padding:5px 12px;background:white;display:inline-block;">
              View tasks →
            </a>
          </td>
        </tr>
      </table>
    </div>`;
  }).join("");

  // Done this week — compact chips
  const doneChips = recentlyDone.map(t =>
    `<span style="display:inline-block;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:20px;padding:4px 12px;font-size:12px;color:#166534;margin:3px;font-weight:500;">✓ ${t.title} <span style="color:#9CA3AF;font-weight:400;">${t.owner}</span></span>`
  ).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="max-width:620px;margin:0 auto;padding:20px 0;">

  <!-- Outer card -->
  <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- ── Status header ── -->
    <div style="background:${headerBg};border-bottom:1px solid ${headerBorder};padding:24px 28px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="vertical-align:top;">
            <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${statusDot};"></span>
              <span style="font-size:12px;font-weight:700;color:${statusColor};text-transform:uppercase;letter-spacing:0.5px;">${statusLabel}</span>
            </div>
            <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111;">Good morning, ${adminName}.</h1>
            <p style="margin:0;font-size:13px;color:#6B7280;">${today}</p>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#4F46E5;color:white;padding:9px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">
              Open Dashboard →
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- ── Main content ── -->
    <div style="padding:24px 28px;">

      <!-- Scorecard -->
      ${scorecardHtml}

      ${needsDecision.length === 0 && drifting.length === 0 && data.overdueCount === 0 ? `
      <!-- All-clear -->
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
        <div style="font-size:32px;margin-bottom:8px;">🎉</div>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#166534;">Team is delivering on time</p>
        <p style="margin:0;font-size:13px;color:#4ADE80;">No blockers, no overdue tasks. Great execution week.</p>
      </div>` : ""}

      <!-- Section: Needs Your Decision -->
      ${needsDecision.length > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#DC2626;"></span>
          <span style="font-size:12px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;">Needs Your Decision</span>
          <span style="background:#FEE2E2;color:#DC2626;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${needsDecision.length}</span>
        </div>
        ${decisionCards}
        <a href="${overdueUrl}" style="display:block;text-align:center;color:#DC2626;font-size:12px;font-weight:600;text-decoration:none;margin-top:8px;">View all overdue tasks →</a>
      </div>` : ""}

      <!-- Section: Drifting -->
      ${drifting.length > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F59E0B;"></span>
          <span style="font-size:12px;font-weight:800;color:#B45309;text-transform:uppercase;letter-spacing:0.5px;">Drifting This Week</span>
          <span style="background:#FEF3C7;color:#B45309;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${drifting.length}</span>
        </div>
        <p style="font-size:12px;color:#9CA3AF;margin:0 0 10px;">Not broken yet — but moving in the wrong direction.</p>
        ${driftingCards}
      </div>` : ""}

      <!-- Section: People Requiring Attention -->
      ${peopleInsight.length > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7C3AED;"></span>
          <span style="font-size:12px;font-weight:800;color:#5B21B6;text-transform:uppercase;letter-spacing:0.5px;">People Requiring Attention</span>
        </div>
        <p style="font-size:12px;color:#9CA3AF;margin:0 0 10px;">Execution patterns matter more than isolated misses.</p>
        ${peopleCards}
      </div>` : ""}

      <!-- Section: Completed This Week -->
      ${recentlyDone.length > 0 ? `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16A34A;"></span>
          <span style="font-size:12px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Completed This Week</span>
        </div>
        <div>${doneChips}</div>
      </div>` : ""}

    </div>

    <!-- ── Footer ── -->
    <div style="background:#F9FAFB;border-top:1px solid #F3F4F6;padding:16px 28px;text-align:center;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#4F46E5;color:white;padding:11px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-bottom:12px;">
        Open Full Dashboard →
      </a>
      <p style="margin:0;font-size:11px;color:#9CA3AF;">Partnr Execution OS · Daily Brief · ${today}</p>
    </div>

  </div>
</div>
</body>
</html>`;

  await sendEmail({ to: adminEmail, subject, html });
}

// ── Owner Update → CEO Notification ───────────────────────────────────

interface OwnerUpdateData {
  adminEmail: string;
  adminName: string;
  ownerName: string;
  taskTitle: string;
  taskId: string;
  action: string;
  note: string;
  quickClose: boolean;
}

export async function sendOwnerUpdateNotification(data: OwnerUpdateData): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const taskUrl = `${baseUrl}/tasks/${data.taskId}`;
  const now = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const actionLabel =
    data.action === "delivered" ? "✅ Delivered" :
    data.action === "delayed"   ? "🕐 Delayed" :
    data.action === "blocked"   ? "🚫 Blocked" : "Updated";

  const actionColor =
    data.action === "delivered" ? "#16A34A" :
    data.action === "delayed"   ? "#B45309" : "#DC2626";

  const quickCloseWarning = data.quickClose && data.action === "delivered"
    ? `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:10px 14px;margin-top:12px;">
        <p style="margin:0;font-size:12px;color:#92400E;">⚠️ <strong>Quick close:</strong> Marked delivered within 60 seconds of opening the email. Verify if needed.</p>
       </div>`
    : "";

  const subject = `${actionLabel}: ${data.ownerName} updated "${data.taskTitle}"`;

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">${now}</p>
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;">
        <span style="color:${actionColor}">${actionLabel}</span>
      </h2>
      <p style="margin:0 0 6px;font-size:14px;"><strong>${data.ownerName}</strong> updated a task assigned to them:</p>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;margin:12px 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:600;">${data.taskTitle}</p>
        <p style="margin:0;font-size:13px;color:#555;">${data.note}</p>
      </div>
      ${quickCloseWarning}
      <p style="margin-top:20px;">
        <a href="${taskUrl}" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">
          View Task →
        </a>
      </p>
      <p style="font-size:11px;color:#aaa;margin-top:32px;">Partnr Execution OS</p>
    </div>`;

  await sendEmail({ to: data.adminEmail, subject, html });
}

// ── Send function ─────────────────────────────────────────────────────

export async function sendEmailReminder(
  type: EmailReminderType,
  taskId: string,
  recipientEmail: string,
  recipientName: string,
  taskData: TaskData,
  extra?: Record<string, string>
): Promise<{ success: boolean; provider: string }> {
  const subject = buildSubject(type, taskData);
  const html = buildBody(type, recipientName, taskData, extra);

  const emailProvider = process.env.EMAIL_PROVIDER?.toUpperCase();
  const provider =
    emailProvider === "GMAIL" && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
      ? "GMAIL"
      : emailProvider === "RESEND" && process.env.RESEND_API_KEY
      ? "RESEND"
      : "MOCK";

  try {
    if (provider === "GMAIL") {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      await transporter.sendMail({
        from: `Partnr Reminders <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject,
        html,
      });
    } else if (provider === "RESEND") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Partnr OS <noreply@partnr.app>",
          to: recipientEmail,
          subject,
          html,
          options: { click_tracking: false, open_tracking: false },
        }),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`Resend API ${res.status}: ${JSON.stringify(resBody)}`);
      }
      // Log Resend's email ID so it can be looked up in the Resend dashboard
      console.log(`[Email RESEND] Accepted | id=${resBody.id} | to=${recipientEmail} | subject="${subject}"`);
    } else {
      // Mock: log to console
      console.log(
        `[Email MOCK] To: ${recipientEmail} | Subject: ${subject} | Type: ${type}`
      );
    }

    // Save to Reminder table
    await prisma.reminder.create({
      data: {
        taskId,
        type,
        channel: "EMAIL",
        recipientName,
        recipientPhone: "",
        recipientEmail,
        provider,
        status: "SENT",
        message: subject,
      },
    });

    return { success: true, provider };
  } catch (err) {
    console.error("[Email] Send failed:", err);
    await prisma.reminder.create({
      data: {
        taskId,
        type,
        channel: "EMAIL",
        recipientName,
        recipientPhone: "",
        recipientEmail,
        provider,
        status: "FAILED",
        message: subject,
        metadata: err instanceof Error ? err.message : String(err),
      },
    });
    return { success: false, provider };
  }
}
