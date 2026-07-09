import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { LiveKitCall, LiveKitCallStatus } from "../../types/index.js";

const TTL_DAYS = 7;

function keys(tenantId: string, callId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `LKCALL#${callId}`,
  };
}

function ttlEpoch(): number {
  return Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;
}

export async function getLiveKitCall(
  tenantId: string,
  callId: string
): Promise<LiveKitCall | null> {
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
  return rest as LiveKitCall;
}

export async function createLiveKitCall(record: LiveKitCall): Promise<void> {
  const now = record.createdAt;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...keys(record.tenantId, record.callId),
        GSI1PK: `CONV#${record.conversationId}#LKCALLS`,
        GSI1SK: `STATUS#${record.status}#${now}#${record.callId}`,
        ttl: ttlEpoch(),
        ...record,
      },
    })
  );
}

export async function updateLiveKitCallStatus(
  tenantId: string,
  callId: string,
  status: LiveKitCallStatus,
  extra?: Partial<Pick<LiveKitCall, "startedAt" | "endedAt">>
): Promise<void> {
  const expressions = ["#status = :status", "#updatedAt = :updatedAt"];
  const names: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": new Date().toISOString(),
  };

  if (extra?.startedAt) {
    expressions.push("#startedAt = :startedAt");
    names["#startedAt"] = "startedAt";
    values[":startedAt"] = extra.startedAt;
  }
  if (extra?.endedAt) {
    expressions.push("#endedAt = :endedAt");
    names["#endedAt"] = "endedAt";
    values[":endedAt"] = extra.endedAt;
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

export async function getActiveLiveKitCallForConversation(
  conversationId: string
): Promise<LiveKitCall | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `CONV#${conversationId}#LKCALLS`,
      },
      ScanIndexForward: false,
      Limit: 10,
    })
  );

  for (const item of result.Items ?? []) {
    const { PK, SK, GSI1PK, GSI1SK, ttl, ...rest } = item;
    void PK;
    void SK;
    void GSI1PK;
    void GSI1SK;
    void ttl;
    const call = rest as LiveKitCall;
    if (call.status === "ringing" || call.status === "active") {
      return call;
    }
  }

  return null;
}

export async function countActiveLiveKitCallsForTenant(tenantId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: "#status IN (:ringing, :active)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "LKCALL#",
        ":ringing": "ringing",
        ":active": "active",
      },
      Select: "COUNT",
    })
  );

  return result.Count ?? 0;
}
