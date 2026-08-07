import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { IntegrationDelivery, IntegrationDeliveryStatus, IntegrationEvent } from "../../types/index.js";

const DELIVERY_TTL_SECONDS = 30 * 24 * 60 * 60;

function deliveryKeys(tenantId: string, botId: string, createdAt: string, deliveryId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `VAWHDEL#${botId}#${createdAt}#${deliveryId}`,
    GSI1PK: `BOT#${botId}#VAWH_DELIVERIES`,
    GSI1SK: `DELIVERY#${createdAt}#${deliveryId}`,
  };
}

export async function createVoiceAgentWebhookDelivery(params: {
  tenantId: string;
  botId: string;
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
        ...deliveryKeys(params.tenantId, params.botId, createdAt, deliveryId),
        botId: params.botId,
        ttl: Math.floor(Date.now() / 1000) + DELIVERY_TTL_SECONDS,
        ...delivery,
      },
    })
  );

  return delivery;
}

export async function listVoiceAgentWebhookDeliveries(
  tenantId: string,
  botId: string,
  limit = 50
): Promise<Array<IntegrationDelivery & { botId: string }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": `BOT#${botId}#VAWH_DELIVERIES` },
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    })
  );

  return (result.Items ?? [])
    .filter((item) => item.tenantId === tenantId)
    .map((item) => {
      const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
      void PK;
      void SK;
      void GSI1PK;
      void GSI1SK;
      void ttl;
      return rest as IntegrationDelivery & { botId: string };
    });
}

export async function updateVoiceAgentWebhookDeliveryStatus(
  tenantId: string,
  botId: string,
  deliveryId: string,
  createdAt: string,
  status: IntegrationDeliveryStatus,
  lastError?: string
): Promise<void> {
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: deliveryKeys(tenantId, botId, createdAt, deliveryId),
      UpdateExpression:
        "SET #status = :status, attempts = if_not_exists(attempts, :zero) + :one" +
        (lastError ? ", lastError = :lastError" : ""),
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":zero": 0,
        ":one": 1,
        ...(lastError ? { ":lastError": lastError } : {}),
      },
    })
  );
}
