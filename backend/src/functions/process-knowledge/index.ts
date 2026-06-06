import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getDocument } from "../../lib/dynamodb/knowledge.repository.js";
import { indexDocument } from "../../lib/knowledge/indexer.js";
import { getOpenAIApiKey } from "../../lib/openai/client.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: { tenantId: string; botId: string; docId: string };
  try {
    body = JSON.parse(record.body) as { tenantId: string; botId: string; docId: string };
  } catch {
    console.error("Invalid knowledge queue message", record.body);
    return;
  }

  const { tenantId, botId, docId } = body;
  const doc = await getDocument(tenantId, botId, docId);
  if (!doc) return;

  const apiKey = await getOpenAIApiKey(tenantId, ENVIRONMENT);
  await indexDocument({
    tenantId,
    botId,
    docId,
    s3Key: doc.s3Key,
    mimeType: doc.mimeType,
    apiKey,
  });
}
