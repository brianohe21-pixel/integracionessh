import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { ApiKeyUsageLog } from "../../types/index.js";

const USAGE_TTL_SECONDS = 90 * 24 * 60 * 60;

function toEpochSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export async function logApiKeyUsage(log: ApiKeyUsageLog): Promise<void> {
  const ttl = toEpochSeconds(new Date()) + USAGE_TTL_SECONDS;

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `APIUSAGE#${log.tenantId}#${log.keyId}`,
        SK: `${log.createdAt}#${log.logId}`,
        ttl,
        ...log,
      },
    })
  );
}

export async function listApiKeyUsageLogs(
  tenantId: string,
  keyId: string,
  limit = 20
): Promise<ApiKeyUsageLog[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `APIUSAGE#${tenantId}#${keyId}`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items ?? []).map((item) => {
    const { PK, SK, ttl, ...rest } = item;
    void PK; void SK; void ttl;
    return rest as unknown as ApiKeyUsageLog;
  });
}

export async function countApiKeyUsageByPeriod(
  tenantId: string,
  keyId: string,
  fromIso: string,
  toIso: string
): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":pk": `APIUSAGE#${tenantId}#${keyId}`,
          ":from": fromIso,
          ":to": toIso,
        },
        Select: "COUNT",
        ExclusiveStartKey: lastKey,
      })
    );

    count += result.Count ?? 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return count;
}
