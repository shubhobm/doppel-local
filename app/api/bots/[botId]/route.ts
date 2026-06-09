import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/request";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  systemPrompt: z.string().max(12000),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  topK: z.number().int().min(1).max(100),
  maxOutputTokens: z.number().int().min(32).max(4096)
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;
  const bot = await db.studentBot.findFirst({
    where: { id: botId, userId: session.user.id },
    include: { documents: true }
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  return NextResponse.json({ bot });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;
  const bot = await db.studentBot.findFirst({
    where: { id: botId, userId: session.user.id }
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  if (bot.status === "SUBMITTED") {
    return NextResponse.json({ error: "Submitted bot cannot be edited until you revert the submission." }, { status: 409 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bot settings." }, { status: 400 });
  }

  const updated = await db.studentBot.update({
    where: { id: bot.id },
    data: {
      name: parsed.data.name,
      systemPrompt: parsed.data.systemPrompt,
      temperature: parsed.data.temperature,
      topP: parsed.data.topP,
      topK: parsed.data.topK,
      maxOutputTokens: parsed.data.maxOutputTokens,
      configVersion: { increment: 1 }
    }
  });

  return NextResponse.json({ bot: updated });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action !== "submit" && action !== "revert") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const bot = await db.studentBot.findFirst({
    where: { id: botId, userId: session.user.id }
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const updated = await db.studentBot.update({
    where: { id: bot.id },
    data:
      action === "submit"
        ? {
            status: "SUBMITTED",
            submittedAt: new Date(),
            configVersion: { increment: 1 }
          }
        : {
            status: "DRAFT",
            submittedAt: null,
            configVersion: { increment: 1 }
          }
  });

  return NextResponse.json({ bot: updated });
}
