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

    // ── Auto-fill owner phone + email from task history ───────────────────
    // For each extracted owner name, look up the most recent task assigned to
    // them that has contact details. This way returning owners like Pallavi
    // get their details pre-filled without any manual entry.
    const ownerNames = Array.from(new Set(tasks.map((t) => t.ownerName).filter(Boolean)));
    if (ownerNames.length > 0) {
      // One DB query: get most recent task per owner that has phone or email
      const previousTasks = await prisma.task.findMany({
        where: {
          owner: { in: ownerNames },
          OR: [
            { ownerEmail: { not: null } },
            { ownerPhone: { not: "" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { owner: true, ownerEmail: true, ownerPhone: true },
      });

      // Build lookup map: ownerName → { email, phone } (first match = most recent)
      const contactMap: Record<string, { email: string; phone: string }> = {};
      for (const pt of previousTasks) {
        if (!contactMap[pt.owner]) {
          contactMap[pt.owner] = {
            email: pt.ownerEmail || "",
            phone: pt.ownerPhone || "",
          };
        }
      }

      // Back-fill extracted tasks — only fill if AI left the field blank
      for (const task of tasks) {
        const contact = contactMap[task.ownerName];
        if (contact) {
          if (!task.ownerEmail && contact.email) task.ownerEmail = contact.email;
          if (!task.ownerPhone && contact.phone) task.ownerPhone = contact.phone;
        }
      }

      const filledCount = tasks.filter((t) => t.ownerEmail || t.ownerPhone).length;
      console.log(`[meeting-notes/extract] Auto-filled contacts for ${filledCount}/${tasks.length} tasks`);
    }
    // ─────────────────────────────────────────────────────────────────────

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
