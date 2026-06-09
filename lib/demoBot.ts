import fs from "fs/promises";
import path from "path";
import { db } from "./db";

const DEMO_BOT_NAME = "Demo Chatbot";

function chunkText(text: string, targetSize = 1200, overlap = 180) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= targetSize) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= targetSize) {
      current = paragraph;
      continue;
    }

    let start = 0;
    while (start < paragraph.length) {
      chunks.push(paragraph.slice(start, start + targetSize));
      start += targetSize - overlap;
    }
    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

export async function ensureDemoBotForUser(userId: string) {
  const existingDemo = await db.studentBot.findFirst({
    where: { userId, isDemo: true },
    include: {
      documents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (existingDemo) {
    return existingDemo;
  }

  const bot = await db.studentBot.create({
    data: {
      userId,
      name: DEMO_BOT_NAME,
      isDemo: true,
      systemPrompt:
        "You are a course assistant demo chatbot. Use uploaded context first, answer clearly, and admit when context is insufficient.",
      temperature: 0.2,
      topP: 1,
      topK: 20,
      maxOutputTokens: 512,
      status: "DRAFT"
    },
    include: {
      documents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  try {
    const notesPath = path.join(process.cwd(), "data", "demo-course-notes.md");
    const notes = await fs.readFile(notesPath, "utf8");
    const chunks = chunkText(notes);

    const document = await db.sourceDocument.create({
      data: {
        botId: bot.id,
        filename: "demo-course-notes.md",
        storagePath: notesPath,
        mimeType: "text/markdown",
        sizeBytes: Buffer.byteLength(notes),
        chunkCount: chunks.length,
        status: "READY"
      }
    });

    for (let index = 0; index < chunks.length; index += 1) {
      await db.documentChunk.create({
        data: {
          documentId: document.id,
          chunkIndex: index,
          content: chunks[index],
          metadata: {
            filename: "demo-course-notes.md",
            chunkIndex: index,
            documentId: document.id
          }
        }
      });
    }
  } catch {
    return bot;
  }

  return db.studentBot.findUniqueOrThrow({
    where: { id: bot.id },
    include: {
      documents: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
}
