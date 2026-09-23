import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { formatDateUtc, resolveMetricsDateRange } from "./call-metrics.js";

export type WhatsAppUsageBucket = "apiOutbound" | "appEcho" | "inbound";

export interface WhatsAppUsageDayCounts {
  apiOutbound: number;
  appEcho: number;
  inbound: number;
}

export interface WhatsAppUsageDailyPoint extends WhatsAppUsageDayCounts {
  date: string;
  total: number;
}

export interface WhatsAppUsageReport {
  from: string;
  to: string;
  botId?: string;
  totals: WhatsAppUsageDayCounts & { total: number };
  daily: WhatsAppUsageDailyPoint[];
}

function emptyCounts(): WhatsAppUsageDayCounts {
  return { apiOutbound: 0, appEcho: 0, inbound: 0 };
}

function totalOf(counts: WhatsAppUsageDayCounts): number {
  return counts.apiOutbound + counts.appEcho + counts.inbound;
}

function tenantPk(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

function tenantDailySk(date: string): string {
  return `WHATSAPP_USAGE#${date}`;
}

function botDailySk(date: string, botId: string): string {
  return `WHATSAPP_USAGE#${date}#BOT#${botId}`;
}

async function incrementDailyItem(
  tenantId: string,
  sk: string,
  date: string,
  bucket: WhatsAppUsageBucket
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

export async function incrementWhatsAppUsage(
  tenantId: string,
  botId: string,
  bucket: WhatsAppUsageBucket,
  at = new Date()
): Promise<void> {
  const date = formatDateUtc(at);
  await Promise.all([
    incrementDailyItem(tenantId, tenantDailySk(date), date, bucket),
    incrementDailyItem(tenantId, botDailySk(date, botId), date, bucket),
  ]);
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

function mapItemCounts(item: Record<string, unknown>): WhatsAppUsageDayCounts {
  return {
    apiOutbound: Number(item.apiOutbound) || 0,
    appEcho: Number(item.appEcho) || 0,
    inbound: Number(item.inbound) || 0,
  };
}

export async function getWhatsAppUsageReport(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<WhatsAppUsageReport> {
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

  const byDate = new Map<string, WhatsAppUsageDayCounts>();
  for (const item of result.Items ?? []) {
    const sk = String(item.SK ?? "");
    if (botId) {
      if (!sk.startsWith(`WHATSAPP_USAGE#`) || !sk.endsWith(`#BOT#${botId}`)) continue;
    } else if (!/^WHATSAPP_USAGE#\d{4}-\d{2}-\d{2}$/.test(sk)) {
      continue;
    }

    const date =
      typeof item.date === "string" && item.date
        ? item.date
        : sk.replace(/^WHATSAPP_USAGE#/, "").slice(0, 10);
    if (!date || date < range.from || date > range.to) continue;
    byDate.set(date, mapItemCounts(item as Record<string, unknown>));
  }

  const daily: WhatsAppUsageDailyPoint[] = eachDateInclusive(range.from, range.to).map((date) => {
    const counts = byDate.get(date) ?? emptyCounts();
    return {
      date,
      ...counts,
      total: totalOf(counts),
    };
  });

  const totals = emptyCounts();
  for (const point of daily) {
    totals.apiOutbound += point.apiOutbound;
    totals.appEcho += point.appEcho;
    totals.inbound += point.inbound;
  }

  return {
    from: range.from,
    to: range.to,
    ...(botId ? { botId } : {}),
    totals: { ...totals, total: totalOf(totals) },
    daily,
  };
}
