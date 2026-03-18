/**
 * Email Notification Provider
 * - If RESEND_API_KEY is set and EMAIL_PROVIDER=RESEND → sends real emails via Resend
 * - Otherwise → mock (logs to console, saves Reminder record)
 */

import { prisma } from "@/lib/prisma";

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
  const taskUrl = `${baseUrl}/tasks/${taskData.id}`;

  const wrap = (content: string) => `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      ${content}
      <p style="margin-top: 24px;">
        <a href="${taskUrl}" style="background: #4F46E5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
          View Task →
        </a>
      </p>
      <p style="margin-top: 32px; font-size: 12px; color: #888;">Partnr Execution OS · <a href="${baseUrl}" style="color: #888;">Dashboard</a></p>
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
  const provider =
    process.env.EMAIL_PROVIDER === "RESEND" && process.env.RESEND_API_KEY
      ? "RESEND"
      : "MOCK";

  try {
    if (provider === "RESEND") {
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
