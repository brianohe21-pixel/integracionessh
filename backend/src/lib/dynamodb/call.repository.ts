import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { CallRecord, CallRecordStatus } from "../../types/index.js";

const TTL_DAYS = 90;

function keys(tenantId: string, callId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CALL#${callId}`,
  };
}

function ttlEpoch(): number {
  return Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;
}

export async function getCallRecord(
  tenantId: string,
  callId: string
): Promise<CallRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, callId),
    })
  );

  if (!result.Item) return null;

  const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = result.Item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void ttl;
  return rest as CallRecord;
}

export async function upsertCallRecord(record: CallRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(record.tenantId, record.callId),
        GSI1PK: `BOT#${record.botId}#CALLS`,
        GSI1SK: `STARTED#${record.startedAt ?? record.createdAt}#${record.callId}`,
        ttl: ttlEpoch(),
        ...record,
      },
    })
  );
}

export async function updateCallRecordStatus(
  tenantId: string,
  callId: string,
  updates: Partial<Pick<CallRecord, "status" | "duration" | "endedAt" | "startedAt">> & {
    status: CallRecordStatus;
  }
): Promise<void> {
  await updateCallRecord(tenantId, callId, updates);
}

export async function updateCallRecord(
  tenantId: string,
  callId: string,
  updates: Partial<
    Pick<
      CallRecord,
      | "status"
      | "duration"
      | "endedAt"
      | "startedAt"
      | "recordingStatus"
      | "recordingS3Key"
      | "recordingDurationSeconds"
      | "telnyxRecordingId"
      | "costStatus"
      | "costBreakdown"
      | "usageMetrics"
      | "queueId"
      | "advisorId"
      | "conferenceId"
      | "disposition"
      | "ivrPath"
      | "waitSeconds"
      | "talkSeconds"
      | "contactCenterMode"
      | "campaignId"
    >
  >
): Promise<void> {
  const now = new Date().toISOString();
  const expressions: string[] = ["#updatedAt = :updatedAt"];
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":updatedAt": now };

  const fieldMap: Array<[keyof typeof updates, string]> = [
    ["status", "status"],
    ["duration", "duration"],
    ["endedAt", "endedAt"],
    ["startedAt", "startedAt"],
    ["recordingStatus", "recordingStatus"],
    ["recordingS3Key", "recordingS3Key"],
    ["recordingDurationSeconds", "recordingDurationSeconds"],
    ["telnyxRecordingId", "telnyxRecordingId"],
    ["costStatus", "costStatus"],
    ["costBreakdown", "costBreakdown"],
    ["usageMetrics", "usageMetrics"],
    ["queueId", "queueId"],
    ["advisorId", "advisorId"],
    ["conferenceId", "conferenceId"],
    ["disposition", "disposition"],
    ["ivrPath", "ivrPath"],
    ["waitSeconds", "waitSeconds"],
    ["talkSeconds", "talkSeconds"],
    ["contactCenterMode", "contactCenterMode"],
    ["campaignId", "campaignId"],
  ];

  for (const [key, attr] of fieldMap) {
    if (updates[key] !== undefined) {
      expressions.push(`#${attr} = :${attr}`);
      names[`#${attr}`] = attr;
      values[`:${attr}`] = updates[key];
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys(tenantId, callId),
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export async function listAllCallsForTenant(tenantId: string): Promise<CallRecord[]> {
  const items: CallRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": "CALL#",
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
      void PK;
      void SK;
      void GSI1PK;
      void GSI1SK;
      void ttl;
      items.push(rest as CallRecord);
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

function mapCallRecordItem(item: Record<string, unknown>): CallRecord {
  const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  void ttl;
  return rest as unknown as CallRecord;
}

function decodeCallListCursor(cursor: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return undefined;
  }
}

function encodeCallListCursor(lastEvaluatedKey: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

export async function listCallsByBot(
  botId: string,
  limit = 50
): Promise<CallRecord[]> {
  const result = await listCallsByBotPaginated(botId, { limit });
  return result.items;
}

export async function listCallsByBotPaginated(
  botId: string,
  options: { limit?: number; cursor?: string; provider?: CallRecord["provider"] } = {}
): Promise<{ items: CallRecord[]; nextCursor?: string }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const exclusiveStartKey = options.cursor ? decodeCallListCursor(options.cursor) : undefined;

  const expressionValues: Record<string, unknown> = {
    ":gsi1pk": `BOT#${botId}#CALLS`,
  };
  let filterExpression: string | undefined;
  if (options.provider) {
    filterExpression = "provider = :provider";
    expressionValues[":provider"] = options.provider;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: expressionValues,
      ...(filterExpression ? { FilterExpression: filterExpression } : {}),
      ScanIndexForward: false,
      Limit: limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    })
  );

  const items = (result.Items ?? []).map((item) => mapCallRecordItem(item));
  const nextCursor = result.LastEvaluatedKey
    ? encodeCallListCursor(result.LastEvaluatedKey)
    : undefined;

  return {
    items,
    ...(nextCursor ? { nextCursor } : {}),
  };
}
