import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOwnerUpdateNotification } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status, note, action, quickClose, newDueDate } = body;

    const validStatuses = ["OPEN", "DONE", "DELAYED", "OVERDUE"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { status };
    if (status === "DONE") updates.closedAt = new Date();
    if (newDueDate) updates.dueDate = new Date(newDueDate);

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updates,
    });

    // Activity log
    await prisma.activity.create({
      data: {
        taskId: params.id,
        type: "STATUS_CHANGE",
        message: `Status changed from ${existing.status} to ${status}`,
      },
    });

    // Quick-close flag — visible to CEO in activity log
    if (quickClose && status === "DONE") {
      await prisma.activity.create({
        data: {
          taskId: params.id,
          type: "NOTE",
          message: `⚠️ Quick close — marked delivered within 60 seconds of opening`,
        },
      });
    }

    // Save owner's note as a comment
    if (note?.trim()) {
      const prefix =
        action === "delivered" ? "✅ Delivered:" :
        action === "delayed"   ? "🕐 Delayed:" :
        action === "blocked"   ? "🚫 Blocked:" : "Update:";

      await prisma.comment.create({
        data: {
          taskId: params.id,
          author: existing.owner || "Owner",
          content: `${prefix} ${note.trim()}`,
        },
      });
    }

    // Notify CEO — fire and forget
    const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
    const adminName  = process.env.ADMIN_NAME || "Admin";
    if (adminEmail && note?.trim()) {
      sendOwnerUpdateNotification({
        adminEmail,
        adminName,
        ownerName: existing.owner || "Owner",
        taskTitle: existing.title,
        taskId: params.id,
        action: action || status.toLowerCase(),
        note: note.trim(),
        quickClose: !!quickClose,
      }).catch((e) => console.error("[email] owner_update failed:", e));
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Update status error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
