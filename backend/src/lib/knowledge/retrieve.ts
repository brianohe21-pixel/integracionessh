import { listAllChunksForBot } from "../dynamodb/knowledge.repository.js";
import { generateEmbedding } from "../openai/client.js";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function retrieveContext(
  tenantId: string,
  botId: string,
  query: string,
  apiKey: string,
  topK = 5
): Promise<string> {
  const chunks = await listAllChunksForBot(tenantId, botId);
  if (chunks.length === 0) return "";

  const queryEmbedding = await generateEmbedding(query, apiKey);
  const ranked = chunks
    .map((chunk) => ({
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score > 0.3);

  if (ranked.length === 0) return "";
  return ranked.map((r) => r.content).join("\n\n---\n\n");
}

export { cosineSimilarity };
