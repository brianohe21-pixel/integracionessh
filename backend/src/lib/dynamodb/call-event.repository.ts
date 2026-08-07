import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "./client.js";
import type { CallEvent, CallEventType } from "../../types/index.js";

const TTL_DAYS = 90;

function keys(tenantId: string, callId: string, eventId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CALL_EVENT#${callId}#${eventId}`,
    GSI1PK: `CALL#${callId}#EVENTS`,
    GSI1SK: `EVENT#${new Date().toISOString()}#${eventId}`,
  };
}

function ttlEpoch(): number {
  return Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;
}

export async function appendCallEvent(params: {
  tenantId: string;
  botId: string;
  callId: string;
  type: CallEventType;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<CallEvent> {
  const eventId = randomUUID();
  const createdAt = new Date().toISOString();
  const event: CallEvent = {
    eventId,
    tenantId: params.tenantId,
    botId: params.botId,
    callId: params.callId,
    type: params.type,
    createdAt,
    ...(params.message ? { message: params.message } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(params.tenantId, params.callId, eventId),
        ttl: ttlEpoch(),
        ...event,
      },
    })
  );

  return event;
}

export async function listCallEvents(
  tenantId: string,
  callId: string,
  limit = 100
): Promise<CallEvent[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": `CALL#${callId}#EVENTS` },
      ScanIndexForward: true,
      Limit: Math.min(limit, 200),
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
      return rest as CallEvent;
    });
}
