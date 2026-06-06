import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type {
  IntegrationDelivery,
  IntegrationDeliveryStatus,
  IntegrationEvent,
  TenantIntegration,
} from "../../types/index.js";

const DEFAULT_INTEGRATION_ID = "default";
const DELIVERY_TTL_SECONDS = 30 * 24 * 60 * 60;

const integrationKeys = (tenantId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `INTEGRATION#${DEFAULT_INTEGRATION_ID}`,
});

const deliveryKeys = (tenantId: string, createdAt: string, deliveryId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `INTDEL#${createdAt}#${deliveryId}`,
});

function stripIntegration(item: Record<string, unknown>): TenantIntegration {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as TenantIntegration;
}

function stripDelivery(item: Record<string, unknown>): IntegrationDelivery {
  const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void ttl;
  return rest as unknown as IntegrationDelivery;
}

export async function getTenantIntegration(
  tenantId: string
): Promise<TenantIntegration | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: integrationKeys(tenantId),
    })
  );
  if (!result.Item) return null;
  return stripIntegration(result.Item);
}

export async function upsertTenantIntegration(
  tenantId: string,
  data: Pick<
    TenantIntegration,
    "webhookUrl" | "webhookSecret" | "subscribedEvents" | "enabled"
  >
): Promise<TenantIntegration> {
  const existing = await getTenantIntegration(tenantId);
  const now = new Date().toISOString();
  const integration: TenantIntegration = {
    integrationId: DEFAULT_INTEGRATION_ID,
    tenantId,
    webhookUrl: data.webhookUrl,
    subscribedEvents: data.subscribedEvents,
    enabled: data.enabled,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(data.webhookSecret !== undefined && data.webhookSecret !== ""
      ? { webhookSecret: data.webhookSecret }
      : existing?.webhookSecret
        ? { webhookSecret: existing.webhookSecret }
        : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...integrationKeys(tenantId), ...integration },
    })
  );

  return integration;
}

export async function createIntegrationDelivery(params: {
  tenantId: string;
  event: IntegrationEvent;
  payload: Record<string, unknown>;
}): Promise<IntegrationDelivery> {
  const deliveryId = randomUUID();
  const createdAt = new Date().toISOString();
  const delivery: IntegrationDelivery = {
    deliveryId,
    tenantId: params.tenantId,
    event: params.event,
    status: "pending",
    attempts: 0,
    payload: params.payload,
    createdAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...deliveryKeys(params.tenantId, createdAt, deliveryId),
        ...delivery,
        ttl: Math.floor(Date.now() / 1000) + DELIVERY_TTL_SECONDS,
      },
    })
  );

  return delivery;
}

export async function updateIntegrationDelivery(
  tenantId: string,
  createdAt: string,
  deliveryId: string,
  updates: Partial<Pick<IntegrationDelivery, "status" | "attempts" | "lastError">>
): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (updates.status !== undefined) {
    expressions.push("#status = :status");
    names["#status"] = "status";
    values[":status"] = updates.status;
  }
  if (updates.attempts !== undefined) {
    expressions.push("#attempts = :attempts");
    names["#attempts"] = "attempts";
    values[":attempts"] = updates.attempts;
  }
  if (updates.lastError !== undefined) {
    expressions.push("#lastError = :lastError");
    names["#lastError"] = "lastError";
    values[":lastError"] = updates.lastError;
  }

  if (expressions.length === 0) return;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: deliveryKeys(tenantId, createdAt, deliveryId),
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function listIntegrationDeliveries(
  tenantId: string,
  limit = 50
): Promise<IntegrationDelivery[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "INTDEL#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items ?? []).map((item) => stripDelivery(item));
}

export function maskIntegrationSecret(
  integration: TenantIntegration
): TenantIntegration & { webhookSecret?: string } {
  if (!integration.webhookSecret) return integration;
  return { ...integration, webhookSecret: "***" };
}

export type { IntegrationDeliveryStatus };
