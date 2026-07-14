import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { PaymentRequest, PaymentRequestStatus } from "../../types/index.js";

const requestKeys = (tenantId: string, paymentId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `PAYREQ#${paymentId}`,
});

function gsi1Keys(tenantId: string, botId: string, createdAt: string, paymentId: string) {
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}`,
    GSI1SK: `CREATED#${createdAt}#${paymentId}`,
  };
}

function stripItem(item: Record<string, unknown>): PaymentRequest {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void GSI1PK;
  void GSI1SK;
  const request = rest as unknown as PaymentRequest;
  if (
    !request.paymentId &&
    typeof SK === "string" &&
    SK.startsWith("PAYREQ#")
  ) {
    request.paymentId = SK.slice("PAYREQ#".length);
  }
  return request;
}

export function makePaymentId(): string {
  return randomUUID();
}

export async function getPaymentRequest(
  tenantId: string,
  paymentId: string
): Promise<PaymentRequest | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: requestKeys(tenantId, paymentId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function createPaymentRequestRecord(
  request: PaymentRequest
): Promise<PaymentRequest> {
  const item = {
    ...requestKeys(request.tenantId, request.paymentId),
    ...gsi1Keys(request.tenantId, request.botId, request.createdAt, request.paymentId),
    ...request,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return request;
}

export async function updatePaymentRequest(
  tenantId: string,
  paymentId: string,
  updates: Partial<
    Pick<
      PaymentRequest,
      "status" | "wompiTransactionId" | "paidAt" | "checkoutUrl" | "updatedAt"
    >
  >
): Promise<PaymentRequest | null> {
  const existing = await getPaymentRequest(tenantId, paymentId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: PaymentRequest = {
    ...existing,
    ...updates,
    updatedAt: updates.updatedAt ?? now,
  };

  const item = {
    ...requestKeys(tenantId, paymentId),
    ...gsi1Keys(updated.tenantId, updated.botId, updated.createdAt, updated.paymentId),
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

export async function listPaymentRequestsForBot(params: {
  tenantId: string;
  botId: string;
  status?: PaymentRequestStatus;
  limit?: number;
}): Promise<PaymentRequest[]> {
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
    items = items.filter((r) => r.status === params.status);
  }
  return items;
}
