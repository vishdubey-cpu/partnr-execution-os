import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailReminder } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (task.ownerEmail) {
      await sendEmailReminder(
        "task_assigned",
        task.id,
        task.ownerEmail,
        task.owner,
        {
          id: task.id,
          title: task.title,
          owner: task.owner,
          dueDate: task.dueDate ?? new Date(),
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[resend-reminder]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
