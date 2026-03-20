/**
 * Reminder Engine
 * Called by POST /api/jobs/process-reminders
 * Sends WhatsApp reminders based on task due dates and overdue thresholds.
 */

import { prisma } from "@/lib/prisma";
import { sendEmailReminder } from "@/lib/email";
import {
  sendWhatsAppMessage,
  hasReminderBeenSentToday,
} from "@/lib/whatsapp";

export interface ReminderJobResult {
  tasks_checked: number;
  reminders_sent: number;
  escalations_sent: number;
  errors: string[];
  detail: string[];
}

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}
function endOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function diffDays(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Look up User record by owner name to get manager details */
async function getManagerInfo(
  ownerName: string,
  ownerPhone: string
): Promise<{ managerName: string; managerPhone: string } | null> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ name: ownerName }, { phone: ownerPhone }],
    },
  });
  if (user?.managerPhone && user?.managerName) {
    return { managerName: user.managerName, managerPhone: user.managerPhone };
  }
  // Fall back to env-configured admin
  if (process.env.ADMIN_PHONE && process.env.ADMIN_NAME) {
    return {
      managerName: process.env.ADMIN_NAME,
      managerPhone: process.env.ADMIN_PHONE,
    };
  }
  return null;
}


/** Send via WhatsApp if phone exists, email if email exists (or both) */
async function notifyOwner(
  type: Parameters<typeof sendWhatsAppMessage>[0] & import("@/lib/email").EmailReminderType,
  taskId: string,
  ownerPhone: string,
  ownerEmail: string | null | undefined,
  ownerName: string,
  taskData: Parameters<typeof sendWhatsAppMessage>[4],
  extra?: Record<string, string>
): Promise<number> {
  let sent = 0;
  if (ownerPhone) {
    await sendWhatsAppMessage(type, taskId, ownerPhone, ownerName, taskData, extra);
    sent++;
  }
  if (ownerEmail) {
    await sendEmailReminder(type, taskId, ownerEmail, ownerName, taskData, extra);
    sent++;
  }
  return sent;
}

export async function processReminders(): Promise<ReminderJobResult> {
  const result: ReminderJobResult = {
    tasks_checked: 0,
    reminders_sent: 0,
    escalations_sent: 0,
    errors: [],
    detail: [],
  };

  const now = new Date();
  const activeTasks = await prisma.task.findMany({
    where: { status: { in: ["OPEN", "DELAYED", "OVERDUE"] } },
  });

  result.tasks_checked = activeTasks.length;

  for (const task of activeTasks) {
    if (!task.dueDate) continue;
    const due = task.dueDate;
    const daysUntilDue = diffDays(now, due); // negative if overdue
    const daysOverdue = -daysUntilDue;

    const taskData = {
      title: task.title,
      owner: task.owner,
      dueDate: task.dueDate,
      id: task.id,
      source: task.source,
    };

    try {
      // ── Due in 2 days ──────────────────────────────────────────
      if (daysUntilDue === 2) {
        if (!(await hasReminderBeenSentToday(task.id, "due_in_2_days"))) {
          await notifyOwner("due_in_2_days", task.id, task.ownerPhone, task.ownerEmail, task.owner, taskData);
          await prisma.activity.create({
            data: { taskId: task.id, type: "REMINDER_SENT", actor: "system", message: "Reminder sent: due in 2 days" },
          });
          result.reminders_sent++;
          result.detail.push(`[due_in_2_days] ${task.title} → ${task.owner}`);
        }
      }

      // ── Due today ─────────────────────────────────────────────
      else if (daysUntilDue === 0 || (daysUntilDue < 0 && daysUntilDue > -1)) {
        if (!(await hasReminderBeenSentToday(task.id, "due_today"))) {
          await notifyOwner("due_today", task.id, task.ownerPhone, task.ownerEmail, task.owner, taskData);
          await prisma.activity.create({
            data: { taskId: task.id, type: "REMINDER_SENT", actor: "system", message: "Reminder sent: due today" },
          });
          result.reminders_sent++;
          result.detail.push(`[due_today] ${task.title} → ${task.owner}`);
        }
      }

      // ── Overdue 1-2 days ──────────────────────────────────────
      else if (daysOverdue >= 1 && daysOverdue < 3) {
        // Mark as OVERDUE if still OPEN
        if (task.status === "OPEN") {
          await prisma.task.update({ where: { id: task.id }, data: { status: "OVERDUE" } });
          await prisma.activity.create({
            data: { taskId: task.id, type: "STATUS_CHANGE", actor: "system", message: "Auto-marked OVERDUE by reminder engine" },
          });
        }
        if (!(await hasReminderBeenSentToday(task.id, "overdue_1_day"))) {
          await notifyOwner("overdue_1_day", task.id, task.ownerPhone, task.ownerEmail, task.owner, taskData);
          await prisma.activity.create({
            data: { taskId: task.id, type: "REMINDER_SENT", actor: "system", message: `Reminder sent: overdue by ${daysOverdue} day(s)` },
          });
          result.reminders_sent++;
          result.detail.push(`[overdue_1_day] ${task.title} → ${task.owner} (${daysOverdue}d overdue)`);
        }
      }

      // ── Overdue 3-6 days → escalate to manager ────────────────
      else if (daysOverdue >= 3 && daysOverdue < 7) {
        if (task.escalationLevel < 1) {
          const manager = await getManagerInfo(task.owner, task.ownerPhone);
          if (manager && !(await hasReminderBeenSentToday(task.id, "escalated_to_manager"))) {
            await sendWhatsAppMessage(
              "escalated_to_manager",
              task.id,
              manager.managerPhone,
              manager.managerName,
              taskData,
              { managerName: manager.managerName }
            );
            await prisma.task.update({
              where: { id: task.id },
              data: { escalationLevel: 1, escalationStatus: "LEVEL1", lastEscalatedAt: now },
            });
            await prisma.activity.create({
              data: {
                taskId: task.id,
                type: "ESCALATION",
                actor: "system",
                message: `Escalated to Level 1 — ${manager.managerName} notified (${daysOverdue}d overdue)`,
              },
            });
            result.escalations_sent++;
            result.detail.push(`[escalated_to_manager] ${task.title} → ${manager.managerName}`);
          }
        }
      }

      // ── Overdue 7+ days → escalate to admin ──────────────────
      else if (daysOverdue >= 7) {
        if (task.escalationLevel < 2) {
          const adminName = process.env.ADMIN_NAME || "Admin";
          const adminPhone = process.env.ADMIN_PHONE;
          if (adminPhone && !(await hasReminderBeenSentToday(task.id, "escalated_to_admin"))) {
            await sendWhatsAppMessage("escalated_to_admin", task.id, adminPhone, adminName, taskData);
            await prisma.task.update({
              where: { id: task.id },
              data: { escalationLevel: 2, escalationStatus: "LEVEL2", lastEscalatedAt: now },
            });
            await prisma.activity.create({
              data: {
                taskId: task.id,
                type: "ESCALATION",
                actor: "system",
                message: `Escalated to Level 2 — Admin office notified (${daysOverdue}d overdue)`,
              },
            });
            result.escalations_sent++;
            result.detail.push(`[escalated_to_admin] ${task.title} → ${adminName}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Task ${task.id} (${task.title}): ${msg}`);
    }
  }

  return result;
}
