import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUserFromRequest } from "@/lib/request";
import { ALLOWED_MIME_TYPES, MAX_FILES, MAX_TOTAL_UPLOAD_BYTES } from "@/lib/limits";
import { chunkText, extractTextFromUpload, saveUploadedFile } from "@/lib/files";
import { embedText } from "@/lib/rag";

function mimeAllowed(file: File) {
  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return true;
  }

  const lower = file.name.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".pdf") || lower.endsWith(".docx");
}

export async function POST(request: NextRequest) {
  if (!env.UPLOADS_ENABLED) {
    return NextResponse.json({ error: "Uploads are currently disabled." }, { status: 403 });
  }

  const session = await getSessionUserFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const botId = String(formData.get("botId") ?? "");
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  if (!botId || !files.length) {
    return NextResponse.json({ error: "Select at least one file." }, { status: 400 });
  }

  const bot = await db.studentBot.findFirst({
    where: { id: botId, userId: session.user.id }
  });
  if (!bot) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  }

  if (bot.status === "SUBMITTED") {
    return NextResponse.json({ error: "Submitted bot cannot accept new uploads until you revert the submission." }, { status: 409 });
  }

  if (files.length + (await db.sourceDocument.count({ where: { botId } })) > MAX_FILES) {
    return NextResponse.json({ error: "File limit exceeded." }, { status: 400 });
  }

  const existingBytes = await db.sourceDocument.aggregate({
    where: { botId },
    _sum: { sizeBytes: true }
  });
  const incomingBytes = files.reduce((sum, file) => sum + file.size, 0);
  if ((existingBytes._sum.sizeBytes ?? 0) + incomingBytes > MAX_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Total upload limit is 100 MB." }, { status: 400 });
  }

  for (const file of files) {
    if (!mimeAllowed(file)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 });
    }
  }

  const results = [];

  for (const file of files) {
    const { storagePath, buffer } = await saveUploadedFile(bot.id, file);
    const text = await extractTextFromUpload(file, buffer);
    const chunks = chunkText(text);
    const document = await db.sourceDocument.create({
      data: {
        botId: bot.id,
        filename: file.name,
        storagePath,
        mimeType: file.type || "text/plain",
        sizeBytes: file.size,
        chunkCount: chunks.length,
        status: "PROCESSING"
      }
    });

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        const embedding = await embedText(content);
        await db.documentChunk.create({
          data: {
            documentId: document.id,
            chunkIndex: index,
            content,
            embedding: embedding ?? undefined,
            metadata: {
              filename: file.name,
              chunkIndex: index,
              documentId: document.id
            }
          }
        });
      }

      await db.sourceDocument.update({
        where: { id: document.id },
        data: { status: "READY" }
      });
      results.push(document.id);
    } catch (error) {
      await db.sourceDocument.update({
        where: { id: document.id },
        data: { status: "FAILED" }
      });
      return NextResponse.json({ error: "Could not process uploaded file." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, uploaded: results.length });
}
