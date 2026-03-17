import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        activities: { orderBy: { createdAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        reminders: { orderBy: { sentAt: "desc" } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Get task error:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { title, description, owner, ownerPhone, ownerEmail, function: fn, priority, dueDate, source, status, escalationLevel } = body;

    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const activityMessages: string[] = [];

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (owner !== undefined) {
      if (owner !== existing.owner) {
        activityMessages.push(`Owner changed from ${existing.owner} to ${owner}`);
      }
      updates.owner = owner;
    }
    if (ownerPhone !== undefined) updates.ownerPhone = ownerPhone;
    if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail || null;
    if (fn !== undefined) updates.function = fn;
    if (priority !== undefined) {
      if (priority !== existing.priority) {
        activityMessages.push(`Priority changed from ${existing.priority} to ${priority}`);
      }
      updates.priority = priority;
    }
    if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
    if (source !== undefined) updates.source = source;
    if (escalationLevel !== undefined) {
      if (escalationLevel !== existing.escalationLevel) {
        activityMessages.push(`Escalation level changed to ${escalationLevel}`);
        const statusMap: Record<number, string> = { 0: "NONE", 1: "LEVEL1", 2: "LEVEL2" };
        updates.escalationStatus = statusMap[escalationLevel] ?? "NONE";
        if (escalationLevel > 0) updates.lastEscalatedAt = new Date();
      }
      updates.escalationLevel = escalationLevel;
    }
    if (status !== undefined && status !== existing.status) {
      activityMessages.push(`Status changed from ${existing.status} to ${status}`);
      updates.status = status;
      if (status === "DONE") {
        updates.closedAt = new Date();
      }
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updates,
    });

    for (const message of activityMessages) {
      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "UPDATE",
          message,
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
