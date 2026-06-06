import { generateEmbedding } from "../openai/client.js";
import { getObjectText } from "../s3/client.js";
import {
  saveChunks,
  updateDocument,
} from "../dynamodb/knowledge.repository.js";

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function indexDocument(params: {
  tenantId: string;
  botId: string;
  docId: string;
  s3Key: string;
  mimeType: string;
  apiKey: string;
}): Promise<number> {
  await updateDocument(params.tenantId, params.botId, params.docId, {
    status: "indexing",
  });

  try {
    const raw = await getObjectText(params.s3Key);
    const textChunks = chunkText(raw);
    if (textChunks.length === 0) {
      throw new Error("Document has no indexable text content");
    }

    const embedded = await Promise.all(
      textChunks.map(async (content, chunkIndex) => ({
        chunkIndex,
        content,
        embedding: await generateEmbedding(content, params.apiKey),
      }))
    );

    await saveChunks(params.tenantId, params.botId, params.docId, embedded);
    await updateDocument(params.tenantId, params.botId, params.docId, {
      status: "ready",
      chunkCount: embedded.length,
    });

    return embedded.length;
  } catch (error) {
    await updateDocument(params.tenantId, params.botId, params.docId, {
      status: "failed",
      errorMessage: (error as Error).message,
    });
    throw error;
  }
}
