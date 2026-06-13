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
  const now = new Date().toISOString();
  const expressions: string[] = ["#status = :status", "#updatedAt = :updatedAt"];
  const names: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":status": updates.status,
    ":updatedAt": now,
  };

  if (updates.duration !== undefined) {
    expressions.push("#duration = :duration");
    names["#duration"] = "duration";
    values[":duration"] = updates.duration;
  }
  if (updates.endedAt !== undefined) {
    expressions.push("#endedAt = :endedAt");
    names["#endedAt"] = "endedAt";
    values[":endedAt"] = updates.endedAt;
  }
  if (updates.startedAt !== undefined) {
    expressions.push("#startedAt = :startedAt");
    names["#startedAt"] = "startedAt";
    values[":startedAt"] = updates.startedAt;
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

export async function listCallsByBot(
  botId: string,
  limit = 50
): Promise<CallRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: { ":gsi1pk": `BOT#${botId}#CALLS` },
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    })
  );

  return (result.Items ?? []).map((item) => {
    const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
    void PK;
    void SK;
    void GSI1PK;
    void GSI1SK;
    void ttl;
    return rest as CallRecord;
  });
}
