import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTwilioWebhook, parseMockWebhook } from "@/lib/whatsapp/inbound-parser";
import { sendWhatsAppMessage, sendRawWhatsAppMessage, hasReminderBeenSentToday } from "@/lib/whatsapp";

/**
 * POST /api/webhooks/whatsapp
 *
 * Handles inbound WhatsApp messages from Twilio or mock test payloads.
 * Supported replies: DONE | DELAYED | NEED HELP
 *
 * Twilio webhook config:
 *   URL: https://your-domain.com/api/webhooks/whatsapp
 *   Method: POST
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let rawBody: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio sends URL-encoded form data
      const text = await req.text();
      rawBody = Object.fromEntries(new URLSearchParams(text));
    } else {
      rawBody = await req.json();
    }

    // Parse to normalised inbound message
    const isTwilio = !!rawBody.AccountSid || !!rawBody.MessagingServiceSid;
    const parsed = isTwilio ? parseTwilioWebhook(rawBody) : parseMockWebhook(rawBody);

    console.log(`[WhatsApp Inbound] from=${parsed.from} type=${parsed.replyType} body="${parsed.body}"`);

    // Find the task associated with this phone number (most recent active task)
    const task = await prisma.task.findFirst({
      where: {
        ownerPhone: parsed.from,
        status: { in: ["OPEN", "DELAYED", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
    });

    if (!task) {
      console.warn(`[WhatsApp Inbound] No active task found for ${parsed.from}`);
      return NextResponse.json({ received: true, matched: false }, { status: 200 });
    }

    // ── Handle reply types ─────────────────────────────────────
    if (parsed.replyType === "DONE") {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "DONE", closedAt: new Date() },
      });
      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "WHATSAPP_REPLY",
          actor: task.owner,
          message: `${task.owner} replied DONE via WhatsApp — task marked complete`,
          metadata: JSON.stringify({ from: parsed.from, body: parsed.body }),
        },
      });
      await prisma.reminder.create({
        data: {
          taskId: task.id,
          type: "INBOUND_REPLY",
          channel: "WHATSAPP",
          recipientName: task.owner,
          recipientPhone: parsed.from,
          provider: isTwilio ? "TWILIO" : "MOCK",
          status: "RECEIVED",
          message: parsed.body,
          metadata: JSON.stringify({ replyType: "DONE" }),
        },
      });
      return NextResponse.json({ received: true, action: "marked_done", taskId: task.id });
    }

    if (parsed.replyType === "ON_TRACK") {
      const nextAction = parsed.nextAction;
      const activityMsg = nextAction
        ? `${task.owner} confirmed ON TRACK via WhatsApp — next step: ${nextAction}`
        : `${task.owner} confirmed ON TRACK via WhatsApp`;

      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "ON_TRACK_UPDATE",
          actor: task.owner,
          message: activityMsg,
          metadata: JSON.stringify({ from: parsed.from, body: parsed.body, nextAction }),
        },
      });
      await prisma.reminder.create({
        data: {
          taskId: task.id,
          type: "INBOUND_REPLY",
          channel: "WHATSAPP",
          recipientName: task.owner,
          recipientPhone: parsed.from,
          provider: isTwilio ? "TWILIO" : "MOCK",
          status: "RECEIVED",
          message: parsed.body,
          metadata: JSON.stringify({ replyType: "ON_TRACK", nextAction }),
        },
      });

      // Send acknowledgement back
      const ackMsg = nextAction
        ? `Thanks ${task.owner} 👍 On track noted. Next step logged: "${nextAction}". If anything changes, reply *BLOCKED* or *DELAYED*.`
        : `Thanks ${task.owner} 👍 On track noted. If anything changes, reply *BLOCKED* or *DELAYED*.`;
      await sendRawWhatsAppMessage(task.id, task.ownerPhone, task.owner, ackMsg, "MANUAL");

      return NextResponse.json({ received: true, action: "on_track_logged", taskId: task.id });
    }

    if (parsed.replyType === "DELAYED") {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "DELAYED" },
      });
      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "WHATSAPP_REPLY",
          actor: task.owner,
          message: `${task.owner} replied DELAYED via WhatsApp${parsed.revisedDate ? ` — new date: ${parsed.revisedDate}` : ""}`,
          metadata: JSON.stringify({ from: parsed.from, body: parsed.body }),
        },
      });
      await prisma.reminder.create({
        data: {
          taskId: task.id,
          type: "INBOUND_REPLY",
          channel: "WHATSAPP",
          recipientName: task.owner,
          recipientPhone: parsed.from,
          provider: isTwilio ? "TWILIO" : "MOCK",
          status: "RECEIVED",
          message: parsed.body,
          metadata: JSON.stringify({ replyType: "DELAYED", revisedDate: parsed.revisedDate }),
        },
      });
      // Ask for revised date (deduped — only once per day)
      if (!(await hasReminderBeenSentToday(task.id, "delayed_followup"))) {
        await sendWhatsAppMessage("delayed_followup", task.id, task.ownerPhone, task.owner, {
          title: task.title, owner: task.owner, dueDate: task.dueDate ?? "", id: task.id,
        });
      }
      return NextResponse.json({ received: true, action: "marked_delayed", taskId: task.id });
    }

    if (parsed.replyType === "NEED_HELP") {
      // Escalate to manager
      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "WHATSAPP_REPLY",
          actor: task.owner,
          message: `${task.owner} replied NEED HELP via WhatsApp — escalation triggered`,
          metadata: JSON.stringify({ from: parsed.from, body: parsed.body }),
        },
      });
      await prisma.reminder.create({
        data: {
          taskId: task.id,
          type: "INBOUND_REPLY",
          channel: "WHATSAPP",
          recipientName: task.owner,
          recipientPhone: parsed.from,
          provider: isTwilio ? "TWILIO" : "MOCK",
          status: "RECEIVED",
          message: parsed.body,
          metadata: JSON.stringify({ replyType: "NEED_HELP" }),
        },
      });

      // Look up manager
      const user = await prisma.user.findFirst({
        where: { OR: [{ name: task.owner }, { phone: task.ownerPhone }] },
      });
      const managerName = user?.managerName || process.env.ADMIN_NAME || "Admin";
      const managerPhone = user?.managerPhone || process.env.ADMIN_PHONE;

      if (managerPhone) {
        await sendWhatsAppMessage(
          "escalated_to_manager",
          task.id,
          managerPhone,
          managerName,
          { title: task.title, owner: task.owner, dueDate: task.dueDate ?? "", id: task.id },
          { managerName }
        );
        await prisma.task.update({
          where: { id: task.id },
          data: { escalationLevel: Math.max(task.escalationLevel, 1), escalationStatus: "LEVEL1", lastEscalatedAt: new Date() },
        });
        await prisma.activity.create({
          data: {
            taskId: task.id,
            type: "ESCALATION",
            actor: "system",
            message: `Escalated to Level 1 — ${managerName} notified (triggered by NEED HELP reply)`,
          },
        });
      }
      return NextResponse.json({ received: true, action: "escalated", taskId: task.id });
    }

    // Unknown reply — just log it
    await prisma.reminder.create({
      data: {
        taskId: task.id,
        type: "INBOUND_REPLY",
        channel: "WHATSAPP",
        recipientName: task.owner,
        recipientPhone: parsed.from,
        provider: isTwilio ? "TWILIO" : "MOCK",
        status: "RECEIVED",
        message: parsed.body,
        metadata: JSON.stringify({ replyType: "UNKNOWN" }),
      },
    });
    return NextResponse.json({ received: true, action: "unknown_reply", taskId: task.id });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/** GET for webhook verification (some providers send a GET challenge) */
export async function GET(req: NextRequest) {
  const challenge = new URL(req.url).searchParams.get("hub.challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ status: "WhatsApp webhook active" });
}
