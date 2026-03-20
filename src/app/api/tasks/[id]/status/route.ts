import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendOwnerUpdateNotification } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status, note, action, quickClose, newDueDate, delayReason } = body;

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

    const updateData: Prisma.TaskUpdateInput = { status };
    if (status === "DONE") updateData.closedAt = new Date();
    if (newDueDate) updateData.dueDate = new Date(newDueDate);
    // Increment delayCount each time owner marks as DELAYED
    if (status === "DELAYED" && existing.status !== "DELAYED") {
      updateData.delayCount = { increment: 1 };
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
    });

    // Activity log — smart based on action
    const statusChanged = existing.status !== status;

    if (action === "on_track") {
      // No status change — owner confirming progress and providing next step
      await prisma.activity.create({
        data: {
          taskId: params.id,
          type: "ON_TRACK_UPDATE",
          actor: existing.owner,
          message: note?.trim()
            ? `${existing.owner} confirmed on track — next step: ${note.trim()}`
            : `${existing.owner} confirmed on track`,
          metadata: JSON.stringify({ action: "on_track" }),
        },
      });
    } else if (statusChanged) {
      const reasonSuffix = delayReason ? ` — reason: ${delayReason}` : "";
      await prisma.activity.create({
        data: {
          taskId: params.id,
          type: "STATUS_CHANGE",
          message: `Status changed from ${existing.status} to ${status}${reasonSuffix}`,
          metadata: delayReason ? JSON.stringify({ delayReason }) : undefined,
        },
      });
    }

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

    // Save owner's note as a comment (skip for on_track — already in activity)
    if (note?.trim() && action !== "on_track") {
      const prefix =
        action === "delivered" ? "✅ Delivered:" :
        action === "delayed"   ? `🕐 Delayed${delayReason ? ` (${delayReason})` : ""}:` :
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
    if (adminEmail && (note?.trim() || action === "on_track")) {
      const notificationNote = action === "on_track"
        ? `On track${note?.trim() ? ` — next step: ${note.trim()}` : ""}`
        : note?.trim() || "";
      if (notificationNote) {
        sendOwnerUpdateNotification({
          adminEmail,
          adminName,
          ownerName: existing.owner || "Owner",
          taskTitle: existing.title,
          taskId: params.id,
          action: action || status.toLowerCase(),
          note: notificationNote,
          quickClose: !!quickClose,
        }).catch((e) => console.error("[email] owner_update failed:", e));
      }
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Update status error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
