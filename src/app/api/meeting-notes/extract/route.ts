import { NextRequest, NextResponse } from "next/server";
import { extractTasksFromNotes } from "@/lib/ai-extractor";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/meeting-notes/extract
 *
 * Body: { meetingName: string, meetingDate: string, rawNotes: string }
 * Returns: { tasks: ExtractedTask[], meetingNoteId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingDate, rawNotes } = body;
    // Auto-generate meeting name from date if not provided
    const meetingName: string =
      body.meetingName?.trim() ||
      `Meeting – ${new Date(meetingDate || Date.now()).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;

    if (!meetingDate || !rawNotes) {
      return NextResponse.json(
        { error: "meetingDate and rawNotes are required" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(meetingDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid meetingDate" }, { status: 400 });
    }

    const { tasks, provider } = await extractTasksFromNotes(rawNotes, meetingName, parsedDate);

    // Persist the meeting note record (without saving tasks yet)
    let meetingNoteId = "";
    try {
      const meetingNote = await prisma.meetingNote.create({
        data: {
          meetingName,
          meetingDate: parsedDate,
          rawNotes,
          extractedJson: JSON.stringify(tasks),
        },
      });
      meetingNoteId = meetingNote.id;
    } catch (dbErr) {
      console.warn("[meeting-notes/extract] Could not save meeting note record:", dbErr);
    }

    console.log(`[meeting-notes/extract] Extracted ${tasks.length} tasks via ${provider} from "${meetingName}"`);

    return NextResponse.json({
      meetingNoteId,
      meetingName,
      meetingDate: parsedDate.toISOString(),
      provider,
      tasks,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[meeting-notes/extract] FATAL ERROR:", msg);
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 });
  }
}
