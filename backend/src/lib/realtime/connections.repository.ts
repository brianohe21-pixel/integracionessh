import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { RealtimeConnection } from "./types.js";

const CONNECTION_TTL_SECONDS = 2 * 60 * 60;

function connectionKeys(tenantId: string, connectionId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `WS#${connectionId}`,
  };
}

function connectionMetaKeys(connectionId: string) {
  return {
    PK: `WS#CONN#${connectionId}`,
    SK: "META",
  };
}

export async function saveRealtimeConnection(params: {
  tenantId: string;
  connectionId: string;
  userId: string;
  role: string;
  advisorId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS;

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...connectionKeys(params.tenantId, params.connectionId),
              GSI1PK: `WS#USER#${params.userId}`,
              GSI1SK: `CONN#${params.connectionId}`,
              connectionId: params.connectionId,
              tenantId: params.tenantId,
              userId: params.userId,
              role: params.role,
              ...(params.advisorId ? { advisorId: params.advisorId } : {}),
              connectedAt: now,
              ttl,
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...connectionMetaKeys(params.connectionId),
              tenantId: params.tenantId,
              ttl,
            },
          },
        },
      ],
    })
  );
}

export async function deleteRealtimeConnection(
  tenantId: string,
  connectionId: string
): Promise<void> {
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: connectionKeys(tenantId, connectionId),
          },
        },
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: connectionMetaKeys(connectionId),
          },
        },
      ],
    })
  );
}

export async function deleteRealtimeConnectionById(connectionId: string): Promise<void> {
  const meta = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: connectionMetaKeys(connectionId),
    })
  );

  const tenantId = meta.Item?.tenantId;
  if (typeof tenantId !== "string" || !tenantId) return;

  await deleteRealtimeConnection(tenantId, connectionId);
}

export async function listRealtimeConnections(tenantId: string): Promise<RealtimeConnection[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "WS#",
      },
    })
  );

  return (result.Items ?? []).map(({ PK, SK, GSI1PK, GSI1SK, ttl, ...rest }) => rest as RealtimeConnection);
}
