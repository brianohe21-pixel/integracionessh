import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { formatDateUtc, resolveMetricsDateRange } from "./call-metrics.js";
import type { WhatsAppCategoryMetricBucket } from "../whatsapp/message-category.js";
import {
  WHATSAPP_PRICING_CATEGORIES,
  type WhatsAppPricingCategory,
} from "../whatsapp/message-category.js";

export const WHATSAPP_CATEGORY_BUCKETS = [
  "marketing",
  "utility",
  "authentication",
  "service",
] as const satisfies readonly WhatsAppCategoryMetricBucket[];

export interface WhatsAppCategoryDayCounts {
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
}

export interface WhatsAppCategoryDailyPoint extends WhatsAppCategoryDayCounts {
  date: string;
  total: number;
}

export interface WhatsAppCategoryByCategoryRow {
  category: WhatsAppPricingCategory;
  count: number;
}

export interface WhatsAppCategoryReport {
  from: string;
  to: string;
  botId?: string;
  totals: WhatsAppCategoryDayCounts & { total: number };
  byCategory: WhatsAppCategoryByCategoryRow[];
  daily: WhatsAppCategoryDailyPoint[];
}

function emptyCounts(): WhatsAppCategoryDayCounts {
  return {
    marketing: 0,
    utility: 0,
    authentication: 0,
    service: 0,
  };
}

function totalOf(counts: WhatsAppCategoryDayCounts): number {
  return WHATSAPP_CATEGORY_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);
}

function tenantPk(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

function tenantDailySk(date: string): string {
  return `WA_CAT#${date}`;
}

function botDailySk(date: string, botId: string): string {
  return `WA_CAT#${date}#BOT#${botId}`;
}

function eachDateInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const [year, month, day] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    cursor = formatDateUtc(next);
  }
  return dates;
}

function mapItemCounts(item: Record<string, unknown>): WhatsAppCategoryDayCounts {
  const counts = emptyCounts();
  for (const bucket of WHATSAPP_CATEGORY_BUCKETS) {
    counts[bucket] = Number(item[bucket]) || 0;
  }
  return counts;
}

function toByCategory(totals: WhatsAppCategoryDayCounts): WhatsAppCategoryByCategoryRow[] {
  return WHATSAPP_PRICING_CATEGORIES.map((category) => ({
    category,
    count: totals[category.toLowerCase() as WhatsAppCategoryMetricBucket],
  }));
}

export function assembleWhatsAppCategoryReport(
  items: Array<Record<string, unknown>>,
  range: { from: string; to: string },
  botId?: string
): WhatsAppCategoryReport {
  const byDate = new Map<string, WhatsAppCategoryDayCounts>();
  for (const item of items) {
    const sk = String(item.SK ?? "");
    if (botId) {
      if (!sk.startsWith("WA_CAT#") || !sk.endsWith(`#BOT#${botId}`)) continue;
    } else if (!/^WA_CAT#\d{4}-\d{2}-\d{2}$/.test(sk)) {
      continue;
    }

    const date =
      typeof item.date === "string" && item.date
        ? item.date
        : sk.replace(/^WA_CAT#/, "").slice(0, 10);
    if (!date || date < range.from || date > range.to) continue;
    byDate.set(date, mapItemCounts(item));
  }

  const daily: WhatsAppCategoryDailyPoint[] = eachDateInclusive(range.from, range.to).map(
    (date) => {
      const counts = byDate.get(date) ?? emptyCounts();
      return {
        date,
        ...counts,
        total: totalOf(counts),
      };
    }
  );

  const totals = emptyCounts();
  for (const point of daily) {
    for (const bucket of WHATSAPP_CATEGORY_BUCKETS) {
      totals[bucket] += point[bucket];
    }
  }

  return {
    from: range.from,
    to: range.to,
    ...(botId ? { botId } : {}),
    totals: { ...totals, total: totalOf(totals) },
    byCategory: toByCategory(totals),
    daily,
  };
}

async function incrementDailyItem(
  tenantId: string,
  sk: string,
  date: string,
  bucket: WhatsAppCategoryMetricBucket
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: tenantPk(tenantId),
        SK: sk,
      },
      UpdateExpression:
        "SET #date = if_not_exists(#date, :date), tenantId = :tenantId, updatedAt = :now ADD #bucket :inc",
      ExpressionAttributeNames: {
        "#date": "date",
        "#bucket": bucket,
      },
      ExpressionAttributeValues: {
        ":date": date,
        ":tenantId": tenantId,
        ":now": new Date().toISOString(),
        ":inc": 1,
      },
    })
  );
}

export async function incrementWhatsAppCategory(
  tenantId: string,
  botId: string,
  bucket: WhatsAppCategoryMetricBucket,
  at = new Date()
): Promise<void> {
  const date = formatDateUtc(at);
  await Promise.all([
    incrementDailyItem(tenantId, tenantDailySk(date), date, bucket),
    incrementDailyItem(tenantId, botDailySk(date, botId), date, bucket),
  ]);
}

export async function getWhatsAppCategoryReport(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<WhatsAppCategoryReport> {
  const range = resolveMetricsDateRange(options);
  const botId = options.botId?.trim() || undefined;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk": tenantPk(tenantId),
        ":from": tenantDailySk(range.from),
        ":to": botId
          ? `${botDailySk(range.to, botId)}\uffff`
          : `${tenantDailySk(range.to)}\uffff`,
      },
    })
  );

  return assembleWhatsAppCategoryReport(
    (result.Items ?? []) as Array<Record<string, unknown>>,
    range,
    botId
  );
}
