import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { MonthlyUsage } from "../../types/index.js";

function usageKeys(tenantId: string, period: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `USAGE#${period}`,
  };
}

export function currentUsagePeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeMonthlyUsage(
  tenantId: string,
  period: string,
  item?: Record<string, unknown>
): MonthlyUsage {
  return {
    tenantId,
    period,
    messagesCount: Number(item?.messagesCount) || 0,
    bulkRecipientsCount: Number(item?.bulkRecipientsCount) || 0,
    campaignsStarted: Number(item?.campaignsStarted) || 0,
  };
}

export async function getMonthlyUsage(
  tenantId: string,
  period = currentUsagePeriod()
): Promise<MonthlyUsage> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: usageKeys(tenantId, period),
    })
  );

  if (!result.Item) {
    return normalizeMonthlyUsage(tenantId, period);
  }

  const { PK, SK, ...rest } = result.Item;
  return normalizeMonthlyUsage(tenantId, period, rest);
}

async function incrementField(
  tenantId: string,
  field: "messagesCount" | "bulkRecipientsCount" | "campaignsStarted",
  amount: number
): Promise<void> {
  const period = currentUsagePeriod();
  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: usageKeys(tenantId, period),
      UpdateExpression:
        "SET #field = if_not_exists(#field, :zero) + :amount, tenantId = :tenantId, #period = :period, updatedAt = :now",
      ExpressionAttributeNames: {
        "#field": field,
        "#period": "period",
      },
      ExpressionAttributeValues: {
        ":amount": amount,
        ":zero": 0,
        ":tenantId": tenantId,
        ":period": period,
        ":now": now,
      },
    })
  );
}

export async function incrementMessages(tenantId: string, count = 1): Promise<void> {
  await incrementField(tenantId, "messagesCount", count);
}

export async function incrementBulkRecipients(
  tenantId: string,
  count: number
): Promise<void> {
  await incrementField(tenantId, "bulkRecipientsCount", count);
}

export async function incrementCampaignsStarted(tenantId: string): Promise<void> {
  await incrementField(tenantId, "campaignsStarted", 1);
}
