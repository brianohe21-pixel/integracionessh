import { randomUUID } from "crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { VoiceAgentHttpTool } from "../../types/index.js";

const toolKeys = (tenantId: string, botId: string, toolId: string) => ({
  PK: `TENANT#${tenantId}#BOT#${botId}`,
  SK: `VOICETOOL#${toolId}`,
});

const gsi1Keys = (tenantId: string, botId: string, sortOrder: number, toolId: string) => ({
  GSI1PK: `TENANT#${tenantId}#BOT#${botId}#VOICETOOLS`,
  GSI1SK: `ORDER#${String(sortOrder).padStart(6, "0")}#${toolId}`,
});

export function makeVoiceAgentToolId(): string {
  return randomUUID();
}

function stripItem(item: Record<string, unknown>): VoiceAgentHttpTool {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  return rest as unknown as VoiceAgentHttpTool;
}

export async function listVoiceAgentHttpTools(
  tenantId: string,
  botId: string
): Promise<VoiceAgentHttpTool[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}#BOT#${botId}`,
        ":sk": "VOICETOOL#",
      },
    })
  );
  return (result.Items ?? [])
    .map((item) => stripItem(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getVoiceAgentHttpTool(
  tenantId: string,
  botId: string,
  toolId: string
): Promise<VoiceAgentHttpTool | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: toolKeys(tenantId, botId, toolId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function getVoiceAgentHttpToolByName(
  tenantId: string,
  botId: string,
  name: string
): Promise<VoiceAgentHttpTool | null> {
  const tools = await listVoiceAgentHttpTools(tenantId, botId);
  return tools.find((tool) => tool.name === name) ?? null;
}

export async function createVoiceAgentHttpTool(
  tool: VoiceAgentHttpTool
): Promise<VoiceAgentHttpTool> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...toolKeys(tool.tenantId, tool.botId, tool.toolId),
        ...gsi1Keys(tool.tenantId, tool.botId, tool.sortOrder, tool.toolId),
        ...tool,
      },
    })
  );
  return tool;
}

export async function updateVoiceAgentHttpTool(
  tenantId: string,
  botId: string,
  toolId: string,
  updates: Partial<
    Pick<
      VoiceAgentHttpTool,
      | "name"
      | "description"
      | "httpUrl"
      | "httpMethod"
      | "httpBody"
      | "httpHeaders"
      | "httpResponseVariable"
      | "parametersJson"
      | "instruction"
      | "enabled"
      | "sortOrder"
      | "updatedAt"
    >
  >
): Promise<VoiceAgentHttpTool | null> {
  const existing = await getVoiceAgentHttpTool(tenantId, botId, toolId);
  if (!existing) return null;
  const merged: VoiceAgentHttpTool = {
    ...existing,
    ...updates,
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...toolKeys(tenantId, botId, toolId),
        ...gsi1Keys(tenantId, botId, merged.sortOrder, toolId),
        ...merged,
      },
    })
  );
  return merged;
}

export async function deleteVoiceAgentHttpTool(
  tenantId: string,
  botId: string,
  toolId: string
): Promise<boolean> {
  const existing = await getVoiceAgentHttpTool(tenantId, botId, toolId);
  if (!existing) return false;
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: toolKeys(tenantId, botId, toolId),
    })
  );
  return true;
}
