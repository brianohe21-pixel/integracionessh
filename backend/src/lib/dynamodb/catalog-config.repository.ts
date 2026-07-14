import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { CatalogConfig } from "../../types/index.js";

const configKeys = (tenantId: string, botId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `APP#catalog#BOT#${botId}`,
});

function gsi1Keys(tenantId: string, botId: string, enabled: boolean) {
  if (!enabled) return {};
  return {
    GSI1PK: `TENANT#${tenantId}#CATALOG`,
    GSI1SK: `ENABLED#1#BOT#${botId}`,
  };
}

function stripItem(item: Record<string, unknown>): CatalogConfig {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as CatalogConfig;
}

export async function getCatalogConfig(
  tenantId: string,
  botId: string
): Promise<CatalogConfig | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId, botId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listCatalogConfigs(tenantId: string): Promise<CatalogConfig[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "APP#catalog#BOT#",
      },
    })
  );
  return (result.Items ?? []).map((item) => stripItem(item));
}

export async function listEnabledCatalogConfigs(tenantId: string): Promise<CatalogConfig[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#CATALOG`,
      },
    })
  );
  return (result.Items ?? []).map((item) => stripItem(item));
}

export async function countEnabledCatalogs(tenantId: string): Promise<number> {
  const configs = await listEnabledCatalogConfigs(tenantId);
  return configs.length;
}

export async function upsertCatalogConfig(config: CatalogConfig): Promise<CatalogConfig> {
  const now = new Date().toISOString();
  const existing = await getCatalogConfig(config.tenantId, config.botId);
  const item = {
    ...configKeys(config.tenantId, config.botId),
    ...gsi1Keys(config.tenantId, config.botId, config.enabled),
    ...config,
    createdAt: existing?.createdAt ?? config.createdAt ?? now,
    updatedAt: now,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return stripItem(item);
}
