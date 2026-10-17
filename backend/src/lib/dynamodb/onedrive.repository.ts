import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { OneDriveConfig } from "../../types/index.js";

const configKeys = (tenantId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: "APP#onedrive",
});

function stripItem<T>(item: Record<string, unknown>): T {
  const { PK, SK, ...rest } = item;
  void PK;
  void SK;
  return rest as T;
}

export async function getOneDriveConfig(tenantId: string): Promise<OneDriveConfig | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
  if (!result.Item) return null;
  return stripItem<OneDriveConfig>(result.Item);
}

export async function upsertOneDriveConfig(config: OneDriveConfig): Promise<OneDriveConfig> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...configKeys(config.tenantId),
        ...config,
      },
    })
  );
  return config;
}

export async function deleteOneDriveConfig(tenantId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: configKeys(tenantId),
    })
  );
}
