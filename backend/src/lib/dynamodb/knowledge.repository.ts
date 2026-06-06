import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { KnowledgeDocument, KnowledgeDocumentStatus } from "../../types/index.js";

const docKeys = (tenantId: string, botId: string, docId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BOT#${botId}#DOC#${docId}`,
});

const chunkKeys = (tenantId: string, botId: string, docId: string, chunkIndex: number) => ({
  PK: `TENANT#${tenantId}`,
  SK: `BOT#${botId}#DOC#${docId}#CHUNK#${String(chunkIndex).padStart(6, "0")}`,
});

function docGsi1(tenantId: string, botId: string, status: KnowledgeDocumentStatus, docId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}#DOCS`,
    GSI1SK: `STATUS#${status}#${docId}`,
  };
}

function stripDoc(item: Record<string, unknown>): KnowledgeDocument {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as KnowledgeDocument;
}

export function makeDocId(): string {
  return randomUUID();
}

export async function getDocument(
  tenantId: string,
  botId: string,
  docId: string
): Promise<KnowledgeDocument | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: docKeys(tenantId, botId, docId) })
  );
  if (!result.Item) return null;
  return stripDoc(result.Item);
}

export async function listDocuments(
  tenantId: string,
  botId: string
): Promise<KnowledgeDocument[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#BOT#${botId}#DOCS`,
      },
    })
  );
  return (result.Items ?? []).map((item) => stripDoc(item));
}

export async function countDocumentsForBot(tenantId: string, botId: string): Promise<number> {
  const docs = await listDocuments(tenantId, botId);
  return docs.length;
}

export async function getTotalStorageBytesForBot(tenantId: string, botId: string): Promise<number> {
  const docs = await listDocuments(tenantId, botId);
  return docs.reduce((sum, d) => sum + (d.sizeBytes ?? 0), 0);
}

export async function createDocument(
  doc: Omit<KnowledgeDocument, "docId" | "createdAt" | "updatedAt" | "chunkCount" | "status"> & {
    docId?: string;
    status?: KnowledgeDocumentStatus;
    chunkCount?: number;
  }
): Promise<KnowledgeDocument> {
  const now = new Date().toISOString();
  const docId = doc.docId ?? makeDocId();
  const full: KnowledgeDocument = {
    ...doc,
    docId,
    status: doc.status ?? "pending",
    chunkCount: doc.chunkCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...docKeys(doc.tenantId, doc.botId, docId),
        ...docGsi1(doc.tenantId, doc.botId, full.status, docId),
        ...full,
      },
    })
  );

  return full;
}

export async function updateDocument(
  tenantId: string,
  botId: string,
  docId: string,
  updates: Partial<Pick<KnowledgeDocument, "status" | "chunkCount" | "errorMessage">>
): Promise<KnowledgeDocument | null> {
  const existing = await getDocument(tenantId, botId, docId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged: KnowledgeDocument = { ...existing, ...updates, updatedAt: now };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...docKeys(tenantId, botId, docId),
        ...docGsi1(tenantId, botId, merged.status, docId),
        ...merged,
      },
    })
  );

  return merged;
}

export async function deleteDocument(
  tenantId: string,
  botId: string,
  docId: string
): Promise<boolean> {
  const existing = await getDocument(tenantId, botId, docId);
  if (!existing) return false;

  const chunks = await listChunks(tenantId, botId, docId);
  const deleteRequests = [
    { DeleteRequest: { Key: docKeys(tenantId, botId, docId) } },
    ...chunks.map((c) => ({
      DeleteRequest: { Key: chunkKeys(tenantId, botId, docId, c.chunkIndex) },
    })),
  ];

  for (let i = 0; i < deleteRequests.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: deleteRequests.slice(i, i + 25) },
      })
    );
  }

  return true;
}

export async function saveChunks(
  tenantId: string,
  botId: string,
  docId: string,
  chunks: Array<{ chunkIndex: number; content: string; embedding: number[] }>
): Promise<void> {
  const puts = chunks.map((chunk) => ({
    PutRequest: {
      Item: {
        ...chunkKeys(tenantId, botId, docId, chunk.chunkIndex),
        docId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
      },
    },
  }));

  for (let i = 0; i < puts.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: puts.slice(i, i + 25) },
      })
    );
  }
}

export async function listChunks(
  tenantId: string,
  botId: string,
  docId: string
): Promise<Array<{ chunkIndex: number; content: string; embedding: number[] }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": `BOT#${botId}#DOC#${docId}#CHUNK#`,
      },
    })
  );

  return (result.Items ?? []).map((item) => ({
    chunkIndex: item.chunkIndex as number,
    content: item.content as string,
    embedding: item.embedding as number[],
  }));
}

export async function listAllChunksForBot(
  tenantId: string,
  botId: string
): Promise<Array<{ content: string; embedding: number[] }>> {
  const docs = await listDocuments(tenantId, botId);
  const ready = docs.filter((d) => d.status === "ready");
  const all: Array<{ content: string; embedding: number[] }> = [];

  for (const doc of ready) {
    const chunks = await listChunks(tenantId, botId, doc.docId);
    all.push(...chunks.map((c) => ({ content: c.content, embedding: c.embedding })));
  }

  return all;
}
