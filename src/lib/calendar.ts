/**
 * Calendar invite generator
 * Generates ICS (iCalendar) files for task deadlines.
 * Sends via email as attachment — works with Google Calendar, Apple Calendar, Outlook.
 */

import nodemailer from "nodemailer";

export interface CalendarInviteData {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  ownerName: string;
  ownerEmail: string;
  dueDate: string;           // YYYY-MM-DD
  meetingName: string;
  sourceText?: string;       // exact quote from meeting notes
  extraAttendees?: string[]; // additional attendee emails
  organizerEmail?: string;
  organizerName?: string;
}

function toICSDate(dateStr: string): string {
  // Convert YYYY-MM-DD to YYYYMMDD
  return dateStr.replace(/-/g, "");
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export function generateICS(data: CalendarInviteData): string {
  const dtStart = toICSDate(data.dueDate);
  // End date = due date + 1 day (all-day event convention)
  const dueObj = new Date(data.dueDate + "T00:00:00");
  dueObj.setDate(dueObj.getDate() + 1);
  const dtEnd = dueObj.toISOString().split("T")[0].replace(/-/g, "");

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `task-${data.taskId}-${Date.now()}@partnr.app`;

  const organizerEmail = data.organizerEmail || process.env.GMAIL_USER || "noreply@partnr.app";
  const organizerName = data.organizerName || process.env.ADMIN_NAME || "Partnr OS";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const taskUrl = `${baseUrl}/task-view/${data.taskId}`;

  const description = [
    data.taskDescription || data.taskTitle,
    data.sourceText ? `\n📌 From meeting: "${data.sourceText}"` : "",
    `\n🔗 Update your task: ${taskUrl}`,
    `\nMeeting: ${data.meetingName}`,
  ].filter(Boolean).join("");

  // Build attendee lines
  const attendees: string[] = [
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${data.ownerName}:mailto:${data.ownerEmail}`,
  ];
  if (data.extraAttendees) {
    for (const email of data.extraAttendees) {
      if (email && email !== data.ownerEmail) {
        attendees.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=OPT-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${email}`);
      }
    }
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Partnr Execution OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeICS(`[Partnr] ${data.taskTitle}`)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `ORGANIZER;CN=${escapeICS(organizerName)}:mailto:${organizerEmail}`,
    ...attendees,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    `URL:${taskUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${escapeICS(data.taskTitle)} is due tomorrow`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

export async function sendCalendarInvite(data: CalendarInviteData): Promise<void> {
  const icsContent = generateICS(data);
  const emailProvider = process.env.EMAIL_PROVIDER?.toUpperCase();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const taskUrl = `${baseUrl}/task-view/${data.taskId}`;

  const dueDateFormatted = new Date(data.dueDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const subject = `📅 Calendar invite: "${data.taskTitle}" — due ${dueDateFormatted}`;

  const contextBlock = data.sourceText
    ? `<div style="background:#F8FAFC;border-left:3px solid #CBD5E1;padding:10px 14px;margin:12px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">📌 What was said in the meeting</p>
        <p style="margin:0;font-size:13px;color:#374151;font-style:italic;">"${data.sourceText}"</p>
       </div>`
    : "";

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
      <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#4F46E5;">📅 Calendar Invite</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6366F1;">A task deadline has been added to your calendar</p>
      </div>

      <p>Hi ${data.ownerName},</p>
      <p>A calendar invite has been sent for the following task from <strong>${data.meetingName}</strong>:</p>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111;">${data.taskTitle}</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">📅 Due: <strong style="color:#DC2626;">${dueDateFormatted}</strong></p>
        ${data.taskDescription ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">${data.taskDescription}</p>` : ""}
      </div>

      ${contextBlock}

      <p style="margin-top:20px;">
        <a href="${taskUrl}" style="background:#4F46E5;color:white;padding:11px 22px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">
          View &amp; Update Task →
        </a>
      </p>

      <p style="font-size:12px;color:#888;margin-top:16px;">
        📎 A calendar file (.ics) is attached. Open it to add this to your calendar — works with Google Calendar, Apple Calendar, and Outlook.
      </p>
      <p style="font-size:11px;color:#aaa;margin-top:24px;border-top:1px solid #F3F4F6;padding-top:16px;">Partnr Execution OS · Task Calendar Invite</p>
    </div>`;

  if (emailProvider === "GMAIL" && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `Partnr Reminders <${process.env.GMAIL_USER}>`,
      to: data.ownerEmail,
      subject,
      html,
      attachments: [{
        filename: "invite.ics",
        content: icsContent,
        contentType: "text/calendar;method=REQUEST",
      }],
    });
  } else if (emailProvider === "RESEND" && process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Partnr OS <noreply@partnr.app>",
        to: data.ownerEmail,
        subject,
        html,
        attachments: [{
          filename: "invite.ics",
          content: Buffer.from(icsContent).toString("base64"),
        }],
      }),
    });
  } else {
    console.log(`[Calendar MOCK] Would send invite to: ${data.ownerEmail} | Task: ${data.taskTitle} | Due: ${data.dueDate}`);
    console.log("[Calendar MOCK] ICS content:\n", icsContent);
  }
}
