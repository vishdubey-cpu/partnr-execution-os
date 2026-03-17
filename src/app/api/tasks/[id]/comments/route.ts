import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { author, content } = body;

    if (!author || !content) {
      return NextResponse.json(
        { error: "author and content are required" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: params.id,
        author,
        content,
      },
    });

    await prisma.activity.create({
      data: {
        taskId: params.id,
        type: "COMMENT_ADDED",
        message: `${author} added a comment`,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
