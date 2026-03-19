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
async function sendEmail(opts: {
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
  | "escalated_to_admin";

interface TaskData {
  id: string;
  title: string;
  owner: string;
  dueDate: Date | string;
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
    case "escalated_to_manager": return `Escalation: Task overdue — ${taskData.title}`;
    case "escalated_to_admin":   return `[Admin] Task escalated: ${taskData.title}`;
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

  const wrap = (content: string) => `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      ${content}
      <p style="margin-top: 24px;">
        <a href="${taskUrl}" style="background: #4F46E5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
          View Task →
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
  }
}

// ── Daily Digest ──────────────────────────────────────────────────────

interface DigestData {
  overdueCount: number;
  dueTodayCount: number;
  silentOverdue: { title: string; owner: string; daysOverdue: number; id: string }[];
  dueTodayTasks: { title: string; owner: string; id: string }[];
  worstOwner?: { owner: string; overdueCount: number };
}

export async function sendDailyDigest(adminEmail: string, adminName: string, data: DigestData): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/dashboard`;

  const silentRows = data.silentOverdue.slice(0, 5).map(
    (t) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #fca5a5;">
        <a href="${baseUrl}/tasks/${t.id}" style="color:#111;text-decoration:none;font-size:13px;font-weight:500;">${t.title}</a>
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #fca5a5;font-size:12px;color:#555;">${t.owner}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #fca5a5;font-size:12px;color:#DC2626;font-weight:600;">${t.daysOverdue}d overdue</td>
    </tr>`
  ).join("");

  const dueTodayRows = data.dueTodayTasks.slice(0, 3).map(
    (t) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #fde68a;">
        <a href="${baseUrl}/tasks/${t.id}" style="color:#111;text-decoration:none;font-size:13px;">${t.title}</a>
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #fde68a;font-size:12px;color:#555;">${t.owner}</td>
    </tr>`
  ).join("");

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111;">
      <h2 style="font-size:20px;font-weight:700;margin:0 0 4px;">Good morning, ${adminName}.</h2>
      <p style="font-size:13px;color:#888;margin:0 0 28px;">Here's what is <strong>NOT</strong> happening in your team today.</p>

      ${data.silentOverdue.length > 0 ? `
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#DC2626;">🚨 ${data.silentOverdue.length} task${data.silentOverdue.length > 1 ? "s" : ""} overdue — owner not responding</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;font-size:11px;color:#888;padding:0 8px 6px;font-weight:600;">TASK</th>
            <th style="text-align:left;font-size:11px;color:#888;padding:0 8px 6px;font-weight:600;">OWNER</th>
            <th style="text-align:left;font-size:11px;color:#888;padding:0 8px 6px;font-weight:600;">STATUS</th>
          </tr></thead>
          <tbody>${silentRows}</tbody>
        </table>
      </div>` : `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#16A34A;">✓ No silent overdue tasks — team is responding to reminders</p>
      </div>`}

      ${data.dueTodayCount > 0 ? `
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#B45309;">⏰ ${data.dueTodayCount} task${data.dueTodayCount > 1 ? "s" : ""} due today</p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${dueTodayRows}</tbody>
        </table>
      </div>` : ""}

      ${data.worstOwner ? `
      <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:14px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#5B21B6;">⚠️ <strong>${data.worstOwner.owner}</strong> has ${data.worstOwner.overdueCount} overdue task${data.worstOwner.overdueCount > 1 ? "s" : ""} — needs attention</p>
      </div>` : ""}

      <p style="margin-bottom:20px;">
        <a href="${dashboardUrl}" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
          View Full Dashboard →
        </a>
      </p>

      <p style="font-size:11px;color:#aaa;margin-top:32px;">Partnr Execution OS · Daily Digest</p>
    </div>`;

  const subject = data.silentOverdue.length > 0
    ? `🚨 ${data.silentOverdue.length} tasks not moving — daily execution update`
    : data.dueTodayCount > 0
    ? `⏰ ${data.dueTodayCount} tasks due today — daily execution update`
    : `✓ All clear — daily execution update`;

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
