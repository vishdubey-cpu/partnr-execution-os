/**
 * POST /api/email-ingest
 *
 * Receives inbound emails (via Resend inbound webhook or Google Apps Script),
 * extracts tasks with AI, auto-creates them in the DB, and sends a confirmation email.
 *
 * Setup:
 *   - Resend inbound: route "tasks@claimback.in" → this URL (with ?secret=...)
 *   - Apps Script:    forward/label emails → script POSTs to this URL
 *
 * Security: set INBOUND_WEBHOOK_SECRET env var; pass as ?secret= or Authorization: Bearer header
 */

import { NextRequest, NextResponse } from "next/server";
import { extractTasksFromNotes } from "@/lib/ai-extractor";
import { prisma } from "@/lib/prisma";
import { sendEmail, sendEmailReminder } from "@/lib/email";
import { isBefore } from "date-fns";

// ── Email body cleaning ───────────────────────────────────────────────────────

/**
 * Strips quoted text, forwarding headers, and signatures from a plain-text email body.
 * Leaves only the original content — the actual meeting notes.
 */
function cleanEmailBody(raw: string): string {
  const lines = raw.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at common signature separators
    if (trimmed === "--" || trimmed === "-- ") break;
    if (/^(regards|thanks|thank you|best regards|warm regards|cheers|sincerely),?\s*$/i.test(trimmed)) break;

    // Skip quoted-reply lines (starting with >)
    if (trimmed.startsWith(">")) continue;

    // Skip forwarding / reply header lines
    if (/^(from|to|cc|bcc|sent|date):[\s]/i.test(trimmed)) continue;
    if (/^on .{5,} wrote:?\s*$/i.test(trimmed)) continue;
    if (/^-{3,}\s*(original|forwarded)\s+(message|email)/i.test(trimmed)) continue;
    if (/^_{3,}$/.test(trimmed)) continue; // Outlook separator line

    kept.push(line);
  }

  // Trim trailing blank lines
  while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();

  return kept.join("\n").trim();
}

/** Strip HTML tags and collapse whitespace */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Clean up email subject into a readable meeting name */
function subjectToMeetingName(subject: string): string {
  return subject
    .replace(/^(fwd?:|fw:|re:)\s*/gi, "")
    .replace(/^(mom|minutes of meeting|meeting notes?|action items?|mom\s*[-–—])\s*/gi, "")
    .trim() || subject;
}

// ── Confirmation email ────────────────────────────────────────────────────────

function buildConfirmationEmail(params: {
  meetingName: string;
  from: string;
  createdCount: number;
  provider: string;
  tasks: { title: string; owner: string; dueDate: Date | null }[];
  baseUrl: string;
}): string {
  const { meetingName, from, createdCount, provider, tasks, baseUrl } = params;

  const taskRows = tasks
    .map(
      (t) => `
        <tr>
          <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111;">${t.title}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#6B7280;">${t.owner || "Unassigned"}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#6B7280;">
            ${t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          </td>
        </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="max-width:600px;margin:0 auto;padding:20px 0;">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <div style="background:#F0FDF4;border-bottom:1px solid #BBF7D0;padding:22px 28px;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#166534;">
        ✓ ${createdCount} task${createdCount !== 1 ? "s" : ""} created automatically
      </p>
      <p style="margin:0;font-size:13px;color:#4ADE80;">
        <strong style="color:#166534;">${meetingName}</strong>
      </p>
    </div>

    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#F9FAFB;">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">Task</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">Owner</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">Due</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>

      <p style="margin-top:24px;">
        <a href="${baseUrl}/dashboard" style="background:#4F46E5;color:white;padding:11px 22px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:700;">
          Open Dashboard →
        </a>
        &nbsp;
        <a href="${baseUrl}/tasks" style="color:#4F46E5;font-size:13px;text-decoration:none;">
          View all tasks
        </a>
      </p>
    </div>

    <div style="background:#F9FAFB;border-top:1px solid #F3F4F6;padding:14px 28px;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;">
        Extracted via ${provider} · Sent by: ${from} · Partnr Execution OS
      </p>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    if (secret) {
      const authHeader = req.headers.get("authorization") || "";
      const tokenFromHeader = authHeader.replace(/^Bearer\s+/i, "");
      const tokenFromQuery = new URL(req.url).searchParams.get("secret");
      if (tokenFromHeader !== secret && tokenFromQuery !== secret) {
        console.warn("[email-ingest] Rejected: invalid secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();

    // ── Parse email payload ──────────────────────────────────────────────
    // Resend inbound format: { type: "email.received", data: { from, subject, text, html, date } }
    // Direct/Apps Script format: { from, subject, text, html?, date }
    const emailData = body.type === "email.received" ? body.data : body;

    const subject: string = emailData.subject || "";
    const from: string = emailData.from || "";
    const rawText: string = emailData.text || "";
    const rawHtml: string = emailData.html || "";
    const emailDate = emailData.date ? new Date(emailData.date) : new Date();

    if (!rawText && !rawHtml) {
      return NextResponse.json({ error: "No email body found" }, { status: 400 });
    }

    // Prefer plain text; fall back to HTML stripped of tags
    const bodyText = rawText || htmlToText(rawHtml);
    const cleanedBody = cleanEmailBody(bodyText);

    if (cleanedBody.length < 30) {
      console.log(`[email-ingest] Body too short after cleaning (${cleanedBody.length} chars), skipping`);
      return NextResponse.json({ created: 0, message: "Email body too short — nothing to extract" });
    }

    const meetingName =
      subjectToMeetingName(subject) ||
      `Email – ${emailDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

    console.log(`[email-ingest] Processing email: "${subject}" from ${from}`);

    // ── AI extraction ────────────────────────────────────────────────────
    const { tasks, provider } = await extractTasksFromNotes(cleanedBody, meetingName, emailDate);

    if (tasks.length === 0) {
      console.log(`[email-ingest] No tasks extracted from "${subject}"`);
      return NextResponse.json({ created: 0, message: "No action items found in email" });
    }

    // ── Auto-fill owner contacts from past tasks ─────────────────────────
    const ownerNames = Array.from(new Set(tasks.map((t) => t.ownerName).filter(Boolean)));
    if (ownerNames.length > 0) {
      const previousTasks = await prisma.task.findMany({
        where: {
          owner: { in: ownerNames },
          OR: [{ ownerEmail: { not: null } }, { ownerPhone: { not: "" } }],
        },
        orderBy: { createdAt: "desc" },
        select: { owner: true, ownerEmail: true, ownerPhone: true },
      });
      const contactMap: Record<string, { email: string; phone: string }> = {};
      for (const pt of previousTasks) {
        if (!contactMap[pt.owner]) {
          contactMap[pt.owner] = { email: pt.ownerEmail || "", phone: pt.ownerPhone || "" };
        }
      }
      for (const task of tasks) {
        const contact = contactMap[task.ownerName];
        if (contact) {
          if (!task.ownerEmail && contact.email) task.ownerEmail = contact.email;
          if (!task.ownerPhone && contact.phone) task.ownerPhone = contact.phone;
        }
      }
    }

    // ── Save meeting note record ─────────────────────────────────────────
    const meetingNote = await prisma.meetingNote.create({
      data: {
        meetingName,
        meetingDate: emailDate,
        rawNotes: cleanedBody,
        extractedJson: JSON.stringify(tasks),
      },
    });

    // ── Create tasks ─────────────────────────────────────────────────────
    const now = new Date();
    const createdTasks: { id: string; title: string; owner: string; dueDate: Date | null; ownerEmail: string }[] = [];

    for (const t of tasks) {
      if (!t.title) continue;

      const due = t.dueDate ? new Date(t.dueDate) : null;
      const validDue = due && !isNaN(due.getTime()) ? due : null;
      const status = validDue && isBefore(validDue, now) ? "OVERDUE" : "OPEN";

      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description || null,
          owner: t.ownerName || "Unassigned",
          ownerPhone: t.ownerPhone || "",
          ownerEmail: t.ownerEmail || null,
          function: t.function || "",
          priority: t.priority || "MEDIUM",
          dueDate: validDue ?? undefined,
          source: t.sourceText ? `${t.sourceText} — ${meetingName}` : meetingName,
          status,
          activities: {
            create: [
              {
                type: "CREATED",
                actor: "email-ingest",
                message: `Auto-created from email: "${subject}" (from: ${from})`,
              },
            ],
          },
        },
      });

      createdTasks.push({
        id: task.id,
        title: task.title,
        owner: task.owner,
        dueDate: task.dueDate,
        ownerEmail: t.ownerEmail || "",
      });

      // Fire assignment email if owner has contact
      if (t.ownerEmail) {
        sendEmailReminder(
          "task_assigned",
          task.id,
          t.ownerEmail,
          task.owner,
          { id: task.id, title: task.title, owner: task.owner, dueDate: task.dueDate ?? new Date(), source: task.source }
        ).catch((e) => console.error(`[email-ingest] assignment email failed for ${task.id}:`, e));
      }
    }

    console.log(`[email-ingest] Created ${createdTasks.length} tasks from "${subject}" via ${provider}`);

    // ── Send confirmation to admin ────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && createdTasks.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const html = buildConfirmationEmail({
        meetingName,
        from,
        createdCount: createdTasks.length,
        provider,
        tasks: createdTasks,
        baseUrl,
      });

      sendEmail({
        to: adminEmail,
        subject: `✓ ${createdTasks.length} tasks created — ${meetingName}`,
        html,
        ccList: [],
      }).catch((e) => console.error("[email-ingest] confirmation email failed:", e));
    }

    return NextResponse.json({
      created: createdTasks.length,
      meetingNoteId: meetingNote.id,
      meetingName,
      provider,
      tasks: createdTasks.map((t) => ({ id: t.id, title: t.title, owner: t.owner })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[email-ingest] Fatal error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
