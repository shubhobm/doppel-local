import { db } from "./db";
import { EMBEDDING_MODEL } from "./limits";
import { getOpenAIClient } from "./openai";

function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2)
  );
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function embedText(text: string) {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  try {
    const result = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000)
    });
    return result.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export async function retrieveRelevantChunks(botId: string, query: string, limit = 6) {
  const client = getOpenAIClient();
  const queryEmbedding = client ? await embedText(query) : null;
  const allChunks = await db.documentChunk.findMany({
    where: {
      document: {
        botId
      }
    },
    include: {
      document: true
    }
  });

  const queryTerms = tokenize(query);

  const scored = allChunks.map((chunk) => {
    const embedding = Array.isArray(chunk.embedding) ? (chunk.embedding as number[]) : null;
    const semanticScore = queryEmbedding && embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
    const chunkTerms = tokenize(chunk.content);
    let lexicalOverlap = 0;
    for (const term of queryTerms) {
      if (chunkTerms.has(term)) {
        lexicalOverlap += 1;
      }
    }
    const lexicalScore = queryTerms.size ? lexicalOverlap / queryTerms.size : 0;
    return {
      chunk,
      score: semanticScore * 0.75 + lexicalScore * 0.25
    };
  });

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      id: chunk.id,
      content: chunk.content,
      score,
      source: {
        filename: chunk.document.filename,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        storagePath: chunk.document.storagePath
      }
    }));
}

export function buildContext(chunks: Array<{ source: { filename: string; chunkIndex: number }; content: string }>) {
  return chunks
    .map((chunk, index) => `Source ${index + 1}: ${chunk.source.filename} [chunk ${chunk.source.chunkIndex + 1}]\n${chunk.content}`)
    .join("\n\n---\n\n");
}
