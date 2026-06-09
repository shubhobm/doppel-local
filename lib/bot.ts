import { db } from "./db";
import { CHAT_HISTORY_LIMIT, CHAT_MODEL } from "./limits";
import { getOpenAIClient } from "./openai";
import { retrieveRelevantChunks } from "./rag";

export async function getOrCreateChatSession(botId: string, sessionKey: string) {
  return db.chatSession.upsert({
    where: {
      botId_sessionKey: {
        botId,
        sessionKey
      }
    },
    update: {},
    create: {
      botId,
      sessionKey
    }
  });
}

export async function saveChatMessage(sessionId: string, role: string, content: string) {
  await db.chatMessage.create({
    data: {
      sessionId,
      role,
      content
    }
  });
}

export async function getRecentMessages(sessionId: string) {
  return db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: CHAT_HISTORY_LIMIT
  });
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);
}

function scoreSentence(questionTerms: Set<string>, sentence: string) {
  const sentenceTerms = new Set(tokenize(sentence));
  let score = 0;
  for (const term of questionTerms) {
    if (sentenceTerms.has(term)) {
      score += 1;
    }
  }
  return score;
}

function fallbackAnswer(question: string, chunks: Array<{ content: string }>) {
  const questionTerms = new Set(tokenize(question));
  const sentences = chunks.flatMap((chunk) =>
    chunk.content
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
  );

  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: scoreSentence(questionTerms, sentence)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    const firstChunk = chunks[0]?.content?.trim();
    if (firstChunk) {
      return `Based on the uploaded material, the most relevant guidance I found is: ${firstChunk.slice(0, 500)}${firstChunk.length > 500 ? "..." : ""}`;
    }

    return "I could not find any uploaded source material to answer from yet.";
  }

  return `Based on the uploaded material, here is the most relevant answer I can derive:\n\n${ranked.map((entry) => `- ${entry.sentence}`).join("\n")}`;
}

function formatRetrievedContext(chunks: Array<{ source: { filename: string; chunkIndex: number }; content: string }>) {
  if (!chunks.length) {
    return "No source material has been uploaded yet.";
  }

  return chunks
    .slice(0, 4)
    .map((chunk, index) => {
      const header = `Source ${index + 1}: ${chunk.source.filename} [chunk ${chunk.source.chunkIndex + 1}]`;
      return `${header}\n${chunk.content.slice(0, 900)}`;
    })
    .join("\n\n---\n\n");
}

export async function generateBotAnswer(params: {
  botId: string;
  sessionKey: string;
  question: string;
}) {
  const bot = await db.studentBot.findUnique({
    where: { id: params.botId },
    include: {
      documents: {
        include: {
          chunks: true
        }
      }
    }
  });

  if (!bot) {
    throw new Error("Bot not found");
  }

  const client = getOpenAIClient();
  const session = await getOrCreateChatSession(bot.id, params.sessionKey);
  const recentMessages = await getRecentMessages(session.id);
  const chunks = await retrieveRelevantChunks(bot.id, params.question, 6);
  const retrievedContext = formatRetrievedContext(chunks);

  const conversation = recentMessages
    .reverse()
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .concat([`USER: ${params.question}`])
    .join("\n\n");

  const systemPrompt = [
    "You are a midterm chatbot built by a student.",
    "Answer the user's question directly and clearly.",
    "Use the provided source context and the conversation history.",
    "If the context is insufficient, say so briefly and give the best grounded answer you can.",
    "Do not mention internal policies or retrieval mechanics unless asked.",
    bot.systemPrompt ? `Student system prompt: ${bot.systemPrompt}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  let answer = "";
  const trace: {
    llmAttempted: boolean;
    llmUsed: boolean;
    fallbackUsed: boolean;
    attempts: number;
    llmModel?: string;
    finishReason?: string | null;
    error?: string;
  } = {
    llmAttempted: false,
    llmUsed: false,
    fallbackUsed: false,
    attempts: 0
  };

  if (client) {
    try {
      const runCompletion = async (contextText: string, budget: number) => {
        trace.llmAttempted = true;
        trace.attempts += 1;
        const completion = await client.chat.completions.create({
          model: CHAT_MODEL,
          max_completion_tokens: budget,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: [
                "Use the retrieved chunks below as the primary source of truth.",
                "If the answer is not in the chunks, say the material is insufficient.",
                "Keep the final answer concise and direct.",
                "",
                `Retrieved chunks:\n${contextText}`,
                "",
                `Conversation so far:\n${conversation}`,
                "",
                `Current question:\n${params.question}`
              ].join("\n")
            }
          ]
        });

        trace.llmModel = completion.model;
        trace.finishReason = completion.choices?.[0]?.finish_reason;
        const rawContent = completion.choices?.[0]?.message?.content;

        if (typeof rawContent === "string") {
          return rawContent.trim();
        }

        return "";
      };

      const completionBudget = Math.max(bot.maxOutputTokens, 1200);
      answer = await runCompletion(retrievedContext, completionBudget);

      if (!answer && trace.finishReason === "length") {
        const shorterContext = formatRetrievedContext(chunks.slice(0, 2));
        answer = await runCompletion(shorterContext, Math.max(completionBudget, 2200));
      }
    } catch (error) {
      console.error("LLM response generation failed", error);
      trace.error = error instanceof Error ? error.message : String(error);
      answer = "";
    }
  }

  if (!answer) {
    trace.fallbackUsed = true;
    answer = fallbackAnswer(params.question, chunks);
  } else {
    trace.llmUsed = true;
  }

  await saveChatMessage(session.id, "user", params.question);
  await saveChatMessage(session.id, "assistant", answer);

  return {
    sessionId: session.id,
    answer,
    chunks,
    trace
  };
}
