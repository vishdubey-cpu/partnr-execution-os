import { MockWhatsAppProvider } from "./mock-provider";
import { TwilioWhatsAppProvider } from "./twilio-provider";
import { templates, buildWeeklySummaryMessage, type ReminderType } from "./templates";
import { prisma } from "@/lib/prisma";
import type { SendResult } from "./mock-provider";

export type { ReminderType };
export { buildWeeklySummaryMessage };

/** Return the active provider based on env config */
function getProvider() {
  if (
    process.env.WHATSAPP_PROVIDER === "TWILIO" &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  ) {
    return new TwilioWhatsAppProvider();
  }
  return new MockWhatsAppProvider();
}

/**
 * Send a templated WhatsApp message.
 * Automatically picks Twilio or Mock based on environment.
 */
export async function sendWhatsAppMessage(
  type: Exclude<ReminderType, "weekly_summary" | "MANUAL">,
  taskId: string,
  recipientPhone: string,
  recipientName: string,
  taskData: { title: string; owner: string; dueDate: Date | string; id: string; function?: string },
  extra?: Record<string, string>
): Promise<SendResult> {
  const message = templates[type](taskData, extra);
  const provider = getProvider();
  return provider.send(recipientPhone, recipientName, message, taskId, type);
}

/**
 * Send a raw WhatsApp message (for weekly summaries or custom messages).
 */
export async function sendRawWhatsAppMessage(
  taskId: string,
  recipientPhone: string,
  recipientName: string,
  message: string,
  type: ReminderType = "weekly_summary"
): Promise<SendResult> {
  const provider = getProvider();
  return provider.send(recipientPhone, recipientName, message, taskId, type);
}

/**
 * Check whether a particular reminder type has already been sent for a task today.
 * Used to prevent duplicate sends when the job runs multiple times.
 */
export async function hasReminderBeenSentToday(
  taskId: string,
  type: string
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await prisma.reminder.findFirst({
    where: {
      taskId,
      type,
      sentAt: { gte: today, lt: tomorrow },
    },
  });
  return !!existing;
}
