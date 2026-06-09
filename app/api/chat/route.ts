import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/request";
import { generateBotAnswer } from "@/lib/bot";

const bodySchema = z.object({
  botId: z.string().min(1),
  sessionKey: z.string().min(1),
  question: z.string().min(1).max(4000)
});

export async function POST(request: NextRequest) {
  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const bot = await db.studentBot.findFirst({
    where: { id: parsed.data.botId, userId: session.user.id }
  });
  if (!bot) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  }

  const result = await generateBotAnswer({
    botId: bot.id,
    sessionKey: parsed.data.sessionKey,
    question: parsed.data.question
  });

  await db.queryLog.create({
    data: {
      botId: bot.id,
      userId: session.user.id,
      actorRole: "STUDENT",
      question: parsed.data.question,
      answer: result.answer,
      configVersion: bot.configVersion
    }
  });

  return NextResponse.json({
    answer: result.answer,
    retrievedChunks: result.chunks.map((chunk) => ({
      filename: chunk.source.filename,
      chunkIndex: chunk.source.chunkIndex
    })),
    trace: result.trace
  });
}
