import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status } = body;

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
    if (status === "DONE") {
      updates.closedAt = new Date();
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updates,
    });

    await prisma.activity.create({
      data: {
        taskId: params.id,
        type: "STATUS_CHANGE",
        message: `Status changed from ${existing.status} to ${status}`,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Update status error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
