import { prisma } from "@/lib/prisma";
import type { ReminderType } from "./templates";

export interface SendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

/**
 * Mock WhatsApp provider — logs to console and persists to Reminder table.
 * Used when no Twilio credentials are configured.
 */
export class MockWhatsAppProvider {
  readonly name = "MOCK";

  async send(
    to: string,
    recipientName: string,
    message: string,
    taskId: string,
    type: ReminderType
  ): Promise<SendResult> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Log to console so devs can see what would be sent
    console.log(`\n📱 [MOCK WhatsApp] → ${to} (${recipientName})`);
    console.log(`   Type: ${type}`);
    console.log(`   Message:\n${message.split("\n").map((l) => `   ${l}`).join("\n")}`);
    console.log(`   messageId: ${messageId}\n`);

    // Persist the outbound record
    await prisma.reminder.create({
      data: {
        taskId,
        type,
        channel: "WHATSAPP",
        recipientName,
        recipientPhone: to,
        provider: "MOCK",
        status: "SENT",
        message,
        metadata: JSON.stringify({ messageId }),
      },
    });

    return { success: true, messageId, provider: "MOCK" };
  }
}
