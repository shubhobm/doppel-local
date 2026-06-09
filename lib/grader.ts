import { db } from "./db";
import { generateBotAnswer } from "./bot";

export async function queryStudentBot(params: {
  studentBotId: string;
  question: string;
  sessionKey?: string;
}) {
  const bot = await db.studentBot.findUnique({
    where: { id: params.studentBotId },
    include: { user: true }
  });

  if (!bot) {
    throw new Error("Student bot not found");
  }

  if (bot.status !== "SUBMITTED") {
    throw new Error("Student bot has not been submitted yet");
  }

  const result = await generateBotAnswer({
    botId: bot.id,
    sessionKey: params.sessionKey ?? "grader",
    question: params.question
  });

  await db.queryLog.create({
    data: {
      botId: bot.id,
      userId: bot.userId,
      actorRole: "GRADER",
      question: params.question,
      answer: result.answer,
      configVersion: bot.configVersion
    }
  });

  return {
    studentId: bot.userId,
    botId: bot.id,
    question: params.question,
    answer: result.answer,
    trace: result.trace,
    model: "gpt-5-nano",
    configVersion: bot.configVersion,
    submittedAt: bot.submittedAt,
    timestamp: new Date().toISOString()
  };
}
