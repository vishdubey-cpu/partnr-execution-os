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
    await fetch("https://api.resend.com/emails", {
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

  const needsDecision = data.needsDecision ?? [];
  const drifting = data.drifting ?? [];
  const peopleInsight = data.peopleInsight ?? [];
  const recentlyDone = data.recentlyDone ?? [];
  const pulse = data.executionPulse;

  // Dynamic subject
  const subject = needsDecision.length > 0
    ? `⚠️ ${needsDecision.length} decision${needsDecision.length > 1 ? "s" : ""} need you today — Partnr Morning Brief`
    : drifting.length > 0
    ? `👀 ${drifting.length} task${drifting.length > 1 ? "s" : ""} drifting this week — Partnr Morning Brief`
    : `✅ Clean execution today — Partnr Morning Brief`;

  const decisionRows = needsDecision.map((t) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #FECACA;">
        <a href="${baseUrl}/tasks/${t.id}" style="color:#111;font-size:13px;font-weight:600;text-decoration:none;">${t.title}</a>
        <p style="margin:2px 0 0;font-size:11px;color:#DC2626;">${t.reason}</p>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #FECACA;font-size:12px;color:#555;white-space:nowrap;">${t.owner}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #FECACA;white-space:nowrap;">
        <a href="${baseUrl}/tasks/${t.id}" style="font-size:11px;font-weight:700;color:#4F46E5;text-decoration:none;">Decide →</a>
      </td>
    </tr>`).join("");

  const driftingRows = drifting.map((t) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #FDE68A;">
        <a href="${baseUrl}/tasks/${t.id}" style="color:#111;font-size:13px;font-weight:500;text-decoration:none;">${t.title}</a>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #FDE68A;font-size:12px;color:#555;white-space:nowrap;">${t.owner}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #FDE68A;font-size:12px;color:#B45309;white-space:nowrap;font-weight:600;">
        Due in ${t.daysUntil <= 0 ? "today" : `${t.daysUntil}d`}
      </td>
    </tr>`).join("");

  const peopleRows = peopleInsight.map((p) => {
    const flags = [];
    if (p.overdue > 0) flags.push(`${p.overdue} overdue`);
    if (p.delays > 1) flags.push(`${p.delays}x delayed`);
    if (p.noResponse > 0) flags.push(`${p.noResponse} silent`);
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #EDE9FE;font-size:13px;font-weight:500;">${p.owner}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #EDE9FE;font-size:12px;color:#7C3AED;">${flags.join(" · ")}</td>
    </tr>`;
  }).join("");

  const doneList = recentlyDone.map((t) =>
    `<span style="display:inline-block;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:4px;padding:3px 8px;font-size:11px;color:#166534;margin:2px;">${t.title} <span style="color:#9CA3AF;">(${t.owner})</span></span>`
  ).join(" ");

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111;">

      <!-- Header -->
      <h2 style="font-size:22px;font-weight:700;margin:0 0 4px;">Good morning, ${adminName}.</h2>
      <p style="font-size:13px;color:#888;margin:0 0 8px;">
        ${needsDecision.length > 0
          ? `<strong style="color:#DC2626;">${needsDecision.length} item${needsDecision.length > 1 ? "s" : ""}</strong> need your decision today.`
          : drifting.length > 0
          ? `No blockers. <strong style="color:#B45309;">${drifting.length} item${drifting.length > 1 ? "s" : ""}</strong> to watch this week.`
          : `Clean execution. Team is on track.`}
        ${pulse ? ` ${pulse.active} active tasks across your team.` : ""}
      </p>

      ${pulse ? `
      <!-- Execution Pulse -->
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin-bottom:24px;display:flex;gap:20px;flex-wrap:wrap;">
        <span style="font-size:12px;color:#555;">📋 <strong>${pulse.active}</strong> active</span>
        <span style="font-size:12px;color:#555;">⏰ <strong>${pulse.dueThisWeek}</strong> due this week</span>
        <span style="font-size:12px;color:#16A34A;">✅ <strong>${pulse.completedOnTime}</strong> completed on time</span>
        <span style="font-size:12px;color:#B45309;">🕐 <strong>${pulse.delayed}</strong> delayed</span>
        <span style="font-size:12px;color:#DC2626;">🔕 <strong>${pulse.noResponse}</strong> no response</span>
      </div>` : ""}

      <!-- Section 1: Needs Your Decision -->
      ${needsDecision.length > 0 ? `
      <div style="margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">🔴 Needs Your Decision</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #FECACA;border-radius:8px;overflow:hidden;">
          <tbody>${decisionRows}</tbody>
        </table>
      </div>` : ""}

      <!-- Section 2: Drifting This Week -->
      ${drifting.length > 0 ? `
      <div style="margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;color:#B45309;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">🟡 Drifting This Week</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #FDE68A;border-radius:8px;overflow:hidden;">
          <tbody>${driftingRows}</tbody>
        </table>
      </div>` : ""}

      <!-- Section 3: People Insight -->
      ${peopleInsight.length > 0 ? `
      <div style="margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;color:#5B21B6;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">👤 People Insight</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #EDE9FE;border-radius:8px;overflow:hidden;background:#FAF5FF;">
          <tbody>${peopleRows}</tbody>
        </table>
      </div>` : ""}

      <!-- Section 4: Done This Week -->
      ${recentlyDone.length > 0 ? `
      <div style="margin-bottom:24px;">
        <p style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">✅ Completed This Week</p>
        <div>${doneList}</div>
      </div>` : ""}

      <!-- CTA -->
      <p style="margin-top:24px;">
        <a href="${dashboardUrl}" style="background:#4F46E5;color:white;padding:11px 22px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600;">
          Open Dashboard →
        </a>
      </p>

      <p style="font-size:11px;color:#aaa;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px;">
        Partnr Execution OS · Daily Brief
      </p>
    </div>`;

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
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend error ${res.status}: ${err}`);
      }
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
