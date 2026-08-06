import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { FlowHookConfig } from "../../types/index.js";

const hookKeys = (tenantId: string, flowId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `FLOWHOOK#${flowId}`,
});

const hookLookupKey = (hookKey: string) => ({
  PK: `LOOKUP#FLOWHOOK#${hookKey}`,
  SK: "META",
});

export async function getFlowHookConfig(
  tenantId: string,
  flowId: string
): Promise<FlowHookConfig | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: hookKeys(tenantId, flowId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as FlowHookConfig;
}

export async function getFlowHookByKey(
  hookKey: string
): Promise<FlowHookConfig | null> {
  const lookup = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: hookLookupKey(hookKey),
    })
  );
  if (!lookup.Item) return null;
  return getFlowHookConfig(lookup.Item.tenantId as string, lookup.Item.flowId as string);
}

export async function putFlowHookConfig(config: FlowHookConfig): Promise<FlowHookConfig> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...hookKeys(config.tenantId, config.flowId),
        ...config,
      },
    })
  );
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...hookLookupKey(config.hookKey),
        tenantId: config.tenantId,
        flowId: config.flowId,
        botId: config.botId,
        updatedAt: config.updatedAt,
      },
    })
  );
  return config;
}

export async function deleteFlowHookConfig(
  tenantId: string,
  flowId: string
): Promise<void> {
  const existing = await getFlowHookConfig(tenantId, flowId);
  if (!existing) return;
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: hookKeys(tenantId, flowId),
    })
  );
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: hookLookupKey(existing.hookKey),
    })
  );
}

export async function listFlowHooksForTenant(tenantId: string): Promise<FlowHookConfig[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "FLOWHOOK#",
      },
    })
  );
  return (result.Items ?? []).map(({ PK, SK, ...rest }) => rest as FlowHookConfig);
}
