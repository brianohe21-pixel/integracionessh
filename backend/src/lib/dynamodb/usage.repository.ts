import { GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

function toPeriod(date: string): string {
  return date.slice(0, 7);
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
    voicebotMinutesCount: Number(item?.voicebotMinutesCount) || 0,
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

function eachPeriodInclusive(fromPeriod: string, toPeriod: string): string[] {
  const periods: string[] = [];
  let [year, month] = fromPeriod.split("-").map(Number);
  const [endYear, endMonth] = toPeriod.split("-").map(Number);

  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return periods;
}

export async function listMonthlyUsageInRange(
  tenantId: string,
  from: string,
  to: string
): Promise<MonthlyUsage[]> {
  const fromPeriod = toPeriod(from);
  const toPeriodValue = toPeriod(to);
  const expected = eachPeriodInclusive(fromPeriod, toPeriodValue);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${tenantId}`,
        ":from": `USAGE#${fromPeriod}`,
        ":to": `USAGE#${toPeriodValue}\uffff`,
      },
    })
  );

  const byPeriod = new Map<string, MonthlyUsage>();
  for (const item of result.Items ?? []) {
    const period =
      typeof item.period === "string" && item.period
        ? item.period
        : String(item.SK ?? "").replace(/^USAGE#/, "").slice(0, 7);
    if (!period || period < fromPeriod || period > toPeriodValue) continue;
    const { PK, SK, ...rest } = item;
    byPeriod.set(period, normalizeMonthlyUsage(tenantId, period, rest));
  }

  return expected.map(
    (period) => byPeriod.get(period) ?? normalizeMonthlyUsage(tenantId, period)
  );
}

export function sumMonthlyUsage(
  tenantId: string,
  periods: MonthlyUsage[]
): MonthlyUsage {
  return periods.reduce(
    (acc, item) => ({
      tenantId,
      period: acc.period,
      messagesCount: acc.messagesCount + item.messagesCount,
      bulkRecipientsCount: acc.bulkRecipientsCount + item.bulkRecipientsCount,
      campaignsStarted: acc.campaignsStarted + item.campaignsStarted,
      voicebotMinutesCount:
        (acc.voicebotMinutesCount ?? 0) + (item.voicebotMinutesCount ?? 0),
    }),
    normalizeMonthlyUsage(tenantId, periods[0]?.period ?? currentUsagePeriod())
  );
}

async function incrementField(
  tenantId: string,
  field: "messagesCount" | "bulkRecipientsCount" | "campaignsStarted" | "voicebotMinutesCount",
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

export async function incrementVoicebotMinutes(
  tenantId: string,
  minutes: number
): Promise<void> {
  await incrementField(tenantId, "voicebotMinutesCount", minutes);
}
