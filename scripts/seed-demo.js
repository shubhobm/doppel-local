const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) {
    return;
  }

  const content = fsSync.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const prisma = new PrismaClient();

const STATIC_USERNAME = "smajumdar";
const STATIC_USER_EMAIL = `${STATIC_USERNAME}@iimb.ac.in`;
const DEMO_MARKER = "Seeded demo bot for the midterm chatbot";
const NOTES_FILE = path.join(process.cwd(), "data", "demo-course-notes.md");

function chunkText(text, targetSize = 1200, overlap = 180) {
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = [];
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
      const part = paragraph.slice(start, start + targetSize);
      chunks.push(part);
      start += targetSize - overlap;
    }
    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

async function main() {
  const notes = await fs.readFile(NOTES_FILE, "utf8");
  const user = await prisma.user.upsert({
    where: { email: STATIC_USER_EMAIL },
    update: { role: "STUDENT" },
    create: { email: STATIC_USER_EMAIL, role: "STUDENT" }
  });

  let bot = await prisma.studentBot.findFirst({
    where: {
      userId: user.id,
      systemPrompt: DEMO_MARKER
    },
    include: {
      documents: {
        include: {
          chunks: true
        }
      }
    }
  });

  if (!bot) {
    bot = await prisma.studentBot.create({
      data: {
        userId: user.id,
        name: "Seeded Demo Chatbot",
        systemPrompt: DEMO_MARKER,
        temperature: 0.2,
        topP: 1,
        topK: 20,
        maxOutputTokens: 512,
        status: "SUBMITTED",
        submittedAt: new Date()
      },
      include: {
        documents: {
          include: {
            chunks: true
          }
        }
      }
    });
  }

  if (!bot.documents.length) {
    const chunks = chunkText(notes);
    const document = await prisma.sourceDocument.create({
      data: {
        botId: bot.id,
        filename: "demo-course-notes.md",
        storagePath: NOTES_FILE,
        mimeType: "text/markdown",
        sizeBytes: Buffer.byteLength(notes),
        chunkCount: chunks.length,
        status: "READY"
      }
    });

    for (let index = 0; index < chunks.length; index += 1) {
      await prisma.documentChunk.create({
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
  }

  const submitted = await prisma.studentBot.update({
    where: { id: bot.id },
    data: {
      status: "SUBMITTED",
      submittedAt: bot.submittedAt ?? new Date()
    }
  });

  console.log(JSON.stringify({ userId: user.id, botId: submitted.id, sourceFile: NOTES_FILE }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });