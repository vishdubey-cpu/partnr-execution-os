import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBefore } from "date-fns";

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
        { title: { contains: search } },
        { owner: { contains: search } },
        { description: { contains: search } },
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
    const { title, description, owner, ownerPhone, function: fn, priority, dueDate, source } = body;

    if (!title || !owner || !ownerPhone || !fn || !dueDate) {
      return NextResponse.json(
        { error: "title, owner, ownerPhone, function, and dueDate are required" },
        { status: 400 }
      );
    }

    const due = new Date(dueDate);
    const now = new Date();
    const initialStatus = isBefore(due, now) ? "OVERDUE" : "OPEN";

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        owner,
        ownerPhone,
        function: fn,
        priority: priority || "MEDIUM",
        dueDate: due,
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

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
