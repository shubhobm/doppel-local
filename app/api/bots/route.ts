import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/request";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bots = await db.studentBot.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      documents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({ bots });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "New chatbot";

  const bot = await db.studentBot.create({
    data: {
      userId: session.user.id,
      name,
      systemPrompt: `You are a study assistant for ${name}.`,
      configVersion: 1
    },
    include: {
      documents: true
    }
  });

  return NextResponse.json({ bot });
}
