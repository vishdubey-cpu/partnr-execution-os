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
    const { meetingName, meetingDate, rawNotes } = body;

    if (!meetingName || !meetingDate || !rawNotes) {
      return NextResponse.json(
        { error: "meetingName, meetingDate, and rawNotes are required" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(meetingDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid meetingDate" }, { status: 400 });
    }

    const tasks = await extractTasksFromNotes(rawNotes, meetingName, parsedDate);

    // Persist the meeting note record (without saving tasks yet)
    const meetingNote = await prisma.meetingNote.create({
      data: {
        meetingName,
        meetingDate: parsedDate,
        rawNotes,
        extractedJson: JSON.stringify(tasks),
      },
    });

    console.log(`[meeting-notes/extract] Extracted ${tasks.length} tasks from "${meetingName}"`);

    return NextResponse.json({
      meetingNoteId: meetingNote.id,
      meetingName,
      meetingDate: parsedDate.toISOString(),
      provider: process.env.OPENAI_API_KEY && process.env.AI_PROVIDER !== "MOCK" ? "openai" : "mock",
      tasks,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[meeting-notes/extract] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
