import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { ApiKey } from "../../types/index.js";

function toItem(key: ApiKey): Record<string, unknown> {
  return {
    PK: `APIKEY#${key.hashedKey}`,
    SK: "METADATA",
    GSI1PK: `TENANT#${key.tenantId}`,
    GSI1SK: `APIKEY#${key.createdAt}`,
    ...key,
  };
}

function fromItem(item: Record<string, unknown>): ApiKey {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK; void SK; void GSI1PK; void GSI1SK;
  return rest as unknown as ApiKey;
}

export async function getApiKeyByHash(hashedKey: string): Promise<ApiKey | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `APIKEY#${hashedKey}`, SK: "METADATA" },
    })
  );
  if (!result.Item) return null;
  return fromItem(result.Item);
}

export async function listApiKeysByTenant(tenantId: string): Promise<ApiKey[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "APIKEY#",
      },
    })
  );
  return (result.Items ?? []).map((i) => fromItem(i));
}

export async function createApiKey(key: ApiKey): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: toItem(key),
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
}

export async function updateApiKey(
  hashedKey: string,
  fields: Partial<Pick<ApiKey, "name" | "enabled" | "rateLimitPerMinute" | "rateLimitPerDay" | "lastUsedAt" | "updatedAt">>
): Promise<ApiKey | null> {
  const sets: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`#${k} = :${k}`);
    names[`#${k}`] = k;
    values[`:${k}`] = v;
  }

  if (sets.length === 0) return null;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `APIKEY#${hashedKey}`, SK: "METADATA" },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;
  return fromItem(result.Attributes);
}

export async function deleteApiKey(hashedKey: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `APIKEY#${hashedKey}`, SK: "METADATA" },
    })
  );
}
