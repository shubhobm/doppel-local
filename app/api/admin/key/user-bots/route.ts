import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const bodySchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional()
  })
  .refine((value) => Boolean(value.userId || value.username), {
    message: "Provide userId or username."
  });

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-admin-key");
  if (!env.ADMIN_API_KEY || apiKey !== env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = parsed.data.username?.trim().toLowerCase();
  const user = await db.user.findFirst({
    where: parsed.data.userId ? { id: parsed.data.userId } : { email: username },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const bots = await db.studentBot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      systemPrompt: true,
      temperature: true,
      topP: true,
      topK: true,
      maxOutputTokens: true,
      configVersion: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          chunkCount: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.email,
      role: user.role,
      createdAt: user.createdAt
    },
    bots
  });
}