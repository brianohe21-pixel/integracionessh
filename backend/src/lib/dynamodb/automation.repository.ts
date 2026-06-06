import { randomUUID } from "crypto";
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { AutomationRule } from "../../types/index.js";

const automationKeys = (tenantId: string, ruleId: string) => ({
  PK: `TENANT#${tenantId}`,
  SK: `AUTOMATION#${ruleId}`,
});

function gsi1Keys(tenantId: string, botId: string, enabled: boolean, priority: number, ruleId: string) {
  if (!enabled) return {};
  const pad = String(priority).padStart(6, "0");
  return {
    GSI1PK: `TENANT#${tenantId}#BOT#${botId}#AUTOMATIONS`,
    GSI1SK: `ENABLED#1#PRIORITY#${pad}#${ruleId}`,
  };
}

function stripItem(item: Record<string, unknown>): AutomationRule {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  void PK;
  void SK;
  void GSI1PK;
  void GSI1SK;
  return rest as unknown as AutomationRule;
}

export function makeAutomationId(): string {
  return randomUUID();
}

export async function getAutomation(
  tenantId: string,
  ruleId: string
): Promise<AutomationRule | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: automationKeys(tenantId, ruleId),
    })
  );
  if (!result.Item) return null;
  return stripItem(result.Item);
}

export async function listAutomations(
  tenantId: string,
  botId?: string
): Promise<AutomationRule[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":sk": "AUTOMATION#",
      },
    })
  );
  const items = (result.Items ?? []).map((item) => stripItem(item));
  if (botId) return items.filter((r) => r.botId === botId);
  return items;
}

export async function listEnabledAutomationsForBot(
  tenantId: string,
  botId: string
): Promise<AutomationRule[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `TENANT#${tenantId}#BOT#${botId}#AUTOMATIONS`,
      },
    })
  );
  return (result.Items ?? []).map((item) => stripItem(item));
}

export async function countAutomationsForBot(
  tenantId: string,
  botId: string
): Promise<number> {
  const rules = await listAutomations(tenantId, botId);
  return rules.length;
}

export async function countScheduledAutomations(tenantId: string): Promise<number> {
  const rules = await listAutomations(tenantId);
  return rules.filter((r) => r.trigger === "schedule" && r.enabled).length;
}

export async function createAutomation(
  rule: Omit<AutomationRule, "ruleId" | "createdAt" | "updatedAt"> & { ruleId?: string }
): Promise<AutomationRule> {
  const now = new Date().toISOString();
  const ruleId = rule.ruleId ?? makeAutomationId();
  const full: AutomationRule = {
    ...rule,
    ruleId,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...automationKeys(rule.tenantId, ruleId),
        ...gsi1Keys(rule.tenantId, rule.botId, full.enabled, full.priority, ruleId),
        ...full,
      },
    })
  );

  return full;
}

export async function updateAutomation(
  tenantId: string,
  ruleId: string,
  updates: Partial<Omit<AutomationRule, "ruleId" | "tenantId" | "createdAt">>
): Promise<AutomationRule | null> {
  const existing = await getAutomation(tenantId, ruleId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const merged: AutomationRule = { ...existing, ...updates, updatedAt: now };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...automationKeys(tenantId, ruleId),
        ...gsi1Keys(tenantId, merged.botId, merged.enabled, merged.priority, ruleId),
        ...merged,
      },
    })
  );

  return merged;
}

export async function deleteAutomation(tenantId: string, ruleId: string): Promise<boolean> {
  const existing = await getAutomation(tenantId, ruleId);
  if (!existing) return false;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: automationKeys(tenantId, ruleId),
    })
  );
  return true;
}
