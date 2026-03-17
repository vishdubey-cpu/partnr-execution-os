import { NextRequest, NextResponse } from "next/server";
import { processReminders } from "@/lib/reminder-engine";

/**
 * POST /api/jobs/process-reminders
 *
 * Trigger the reminder + escalation engine.
 * Designed to be called by n8n, a cron job, or manually.
 *
 * Optional: protect with REMINDER_JOB_SECRET header
 * Header: x-job-secret: <value of REMINDER_JOB_SECRET env var>
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REMINDER_JOB_SECRET;
  if (secret) {
    const provided = req.headers.get("x-job-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    console.log("[process-reminders] Job started at", new Date().toISOString());
    const result = await processReminders();
    console.log("[process-reminders] Done:", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[process-reminders] Fatal error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** GET — used for n8n HTTP Request node health check */
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/jobs/process-reminders",
    description: "Processes due-date reminders and escalations for all active tasks",
    status: "ready",
  });
}
