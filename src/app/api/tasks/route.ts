import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBefore } from "date-fns";
import { sendEmailReminder } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const fn = searchParams.get("function");
    const owner = searchParams.get("owner");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (status && status !== "ALL") where.status = status;
    if (priority && priority !== "ALL") where.priority = priority;
    if (fn && fn !== "ALL") where.function = fn;
    if (owner && owner !== "ALL") where.owner = { contains: owner };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { owner: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, owner, ownerPhone, ownerEmail, function: fn, priority, dueDate, source } = body;

    if (!title || !owner || !fn || (!ownerPhone && !ownerEmail)) {
      return NextResponse.json(
        { error: "title, owner, function, and at least one of ownerPhone or ownerEmail are required" },
        { status: 400 }
      );
    }

    const due = dueDate ? new Date(dueDate) : null;
    const now = new Date();
    const initialStatus = due && isBefore(due, now) ? "OVERDUE" : "OPEN";

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        owner,
        ownerEmail: ownerEmail || null,
        ownerPhone: ownerPhone || "",
        function: fn,
        priority: priority || "MEDIUM",
        dueDate: due ?? undefined,
        source: source || null,
        status: initialStatus,
        activities: {
          create: [
            {
              type: "CREATED",
              message: `Task created and assigned to ${owner}`,
            },
          ],
        },
      },
      include: {
        activities: true,
      },
    });

    // Send assignment email if owner has email
    if (ownerEmail) {
      sendEmailReminder(
        "task_assigned",
        task.id,
        ownerEmail,
        owner,
        { id: task.id, title: task.title, owner: task.owner, dueDate: task.dueDate ?? new Date(), source: task.source }
      ).catch((e) => console.error("[email] task_assigned failed:", e));
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
