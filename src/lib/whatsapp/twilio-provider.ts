import { prisma } from "@/lib/prisma";
import type { ReminderType } from "./templates";
import type { SendResult } from "./mock-provider";

/**
 * Twilio WhatsApp provider.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in env.
 */
export class TwilioWhatsAppProvider {
  readonly name = "TWILIO";
  private accountSid: string;
  private authToken: string;
  private from: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID!;
    this.authToken = process.env.TWILIO_AUTH_TOKEN!;
    this.from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  }

  async send(
    to: string,
    recipientName: string,
    message: string,
    taskId: string,
    type: ReminderType
  ): Promise<SendResult> {
    const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: this.from,
          To: toWhatsApp,
          Body: message,
        }),
      });

      const data = (await response.json()) as { sid?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message || `Twilio error ${response.status}`);
      }

      await prisma.reminder.create({
        data: {
          taskId,
          type,
          channel: "WHATSAPP",
          recipientName,
          recipientPhone: to,
          provider: "TWILIO",
          status: "SENT",
          message,
          metadata: JSON.stringify({ sid: data.sid }),
        },
      });

      return { success: true, messageId: data.sid, provider: "TWILIO" };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Twilio] Send failed to ${to}:`, errMsg);

      await prisma.reminder.create({
        data: {
          taskId,
          type,
          channel: "WHATSAPP",
          recipientName,
          recipientPhone: to,
          provider: "TWILIO",
          status: "FAILED",
          message,
          metadata: JSON.stringify({ error: errMsg }),
        },
      });

      return { success: false, error: errMsg, provider: "TWILIO" };
    }
  }
}
