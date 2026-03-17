import { NextRequest, NextResponse } from "next/server";
import { generateWeeklySummary } from "@/lib/weekly-summary";

/**
 * GET /api/jobs/weekly-summary
 *
 * Returns comprehensive weekly execution summary as JSON.
 * Also includes a pre-formatted WhatsApp text in `whatsappSummaryText`.
 *
 * Can be triggered by n8n every Monday morning.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.REMINDER_JOB_SECRET;
  if (secret) {
    const provided = req.headers.get("x-job-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const report = await generateWeeklySummary();
    return NextResponse.json(report);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[weekly-summary] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
