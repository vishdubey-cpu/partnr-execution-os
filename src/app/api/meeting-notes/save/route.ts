import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBefore } from "date-fns";
import { sendEmailReminder } from "@/lib/email";

/**
 * POST /api/meeting-notes/save
 *
 * Saves approved extracted tasks into the database.
 * Body: {
 *   meetingNoteId: string,
 *   meetingName: string,
 *   meetingDate: string,
 *   tasks: Array<ExtractedTask & { selected: boolean }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetingNoteId, meetingName, meetingDate, tasks } = body;

    if (!Array.isArray(tasks)) {
      return NextResponse.json({ error: "tasks must be an array" }, { status: 400 });
    }

    const selectedTasks = tasks.filter((t: { selected?: boolean }) => t.selected !== false);

    if (selectedTasks.length === 0) {
      return NextResponse.json({ error: "No tasks selected" }, { status: 400 });
    }

    const createdTasks = [];
    const now = new Date();

    for (const t of selectedTasks) {
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
          // Use the exact sentence from the meeting notes as source context.
          // Falls back to meeting name if no per-task sourceText was extracted.
          source: t.sourceText
            ? `${t.sourceText} — ${meetingName}`
            : `${meetingName}${meetingDate ? ` (${new Date(meetingDate).toDateString()})` : ""}`,
          status,
          activities: {
            create: [
              {
                type: "CREATED",
                actor: "system",
                message: `Task extracted from meeting: ${meetingName}`,
              },
            ],
          },
        },
      });
      createdTasks.push(task);

      // Send assignment email if owner has email
      if (t.ownerEmail) {
        sendEmailReminder(
          "task_assigned",
          task.id,
          t.ownerEmail,
          task.owner,
          { id: task.id, title: task.title, owner: task.owner, dueDate: task.dueDate ?? new Date(), source: task.source }
        ).catch((e) => console.error("[email] task_assigned failed:", e));
      }
    }

    // Update meeting note to mark as saved
    if (meetingNoteId) {
      await prisma.meetingNote.update({
        where: { id: meetingNoteId },
        data: { extractedJson: JSON.stringify(tasks) },
      });
    }

    return NextResponse.json({
      saved: createdTasks.length,
      skipped: selectedTasks.length - createdTasks.length,
      taskIds: createdTasks.map((t) => t.id),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[meeting-notes/save] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
