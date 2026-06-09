import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { queryStudentBot } from "@/lib/grader";

const bodySchema = z.object({
  studentId: z.string().min(1),
  question: z.string().min(1).max(4000),
  examId: z.string().optional(),
  sessionKey: z.string().optional()
});

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-grader-key");
  if (!env.GRADER_API_KEY || apiKey !== env.GRADER_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid grader query." }, { status: 400 });
  }

  const result = await queryStudentBot({
    studentBotId: parsed.data.studentId,
    question: parsed.data.question,
    sessionKey: parsed.data.sessionKey
  });

  return NextResponse.json(result);
}
