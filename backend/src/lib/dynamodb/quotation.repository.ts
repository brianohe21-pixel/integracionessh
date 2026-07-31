import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { Quotation, QuotationStatus } from "../../types/index.js";

const quotationKeys = (tenantId: string, quotationId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `QUOTE#${quotationId}`,
});

function gsi1Keys(tenantId: string, botId: string, createdAt: string, quotationId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}`,
    GSI1SK: `CREATED#${createdAt}#${quotationId}`,
  };
}

function stripItem(item: Record<string, unknown>): Quotation {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  const quotation = rest as unknown as Quotation;
  if (
    !quotation.quotationId &&
    typeof SK === "string" &&
    SK.startsWith("QUOTE#")
  ) {
    quotation.quotationId = SK.slice("QUOTE#".length);
  }
  return quotation;
}

export function makeQuotationId(): string {
  return randomUUID();
}

export async function getQuotation(
  tenantId: string,
  quotationId: string
): Promise<Quotation | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: quotationKeys(tenantId, quotationId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function createQuotationRecord(quotation: Quotation): Promise<Quotation> {
  const item = {
    ...quotationKeys(quotation.tenantId, quotation.quotationId),
    ...gsi1Keys(
      quotation.tenantId,
      quotation.botId,
      quotation.createdAt,
      quotation.quotationId
    ),
    ...quotation,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return quotation;
}

export async function updateQuotation(
  tenantId: string,
  quotationId: string,
  updates: Partial<
    Pick<
      Quotation,
      | "status"
      | "paymentId"
      | "pdfS3Key"
      | "pdfDownloadUrl"
      | "sentAt"
      | "updatedAt"
    >
  >
): Promise<Quotation | null> {
  const existing = await getQuotation(tenantId, quotationId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Quotation = {
    ...existing,
    ...updates,
    updatedAt: updates.updatedAt ?? now,
  };

  const item = {
    ...quotationKeys(tenantId, quotationId),
    ...gsi1Keys(updated.tenantId, updated.botId, updated.createdAt, updated.quotationId),
    ...updated,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return updated;
}

export async function listQuotationsForBot(params: {
  tenantId: string;
  botId: string;
  status?: QuotationStatus;
  limit?: number;
}): Promise<Quotation[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${params.tenantId}#BOT#${params.botId}`,
      },
      ScanIndexForward: false,
      Limit: params.limit ?? 100,
    })
  );
  let items = (result.Items ?? []).map((item) => stripItem(item));
  if (params.status) {
    items = items.filter((q) => q.status === params.status);
  }
  return items;
}

export async function listQuotationsForConversation(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  limit?: number;
}): Promise<Quotation[]> {
  const items = await listQuotationsForBot({
    tenantId: params.tenantId,
    botId: params.botId,
    limit: params.limit ?? 100,
  });
  return items.filter((q) => q.conversationId === params.conversationId);
}
