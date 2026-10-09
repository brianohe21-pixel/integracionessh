import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { formatDateUtc, resolveMetricsDateRange } from "./call-metrics.js";
import type { MessageWindowBucket } from "../whatsapp/messaging-windows.js";

export const MESSAGE_WINDOW_BUCKETS = [
  "inboundService24h",
  "outboundService24h",
  "inboundFreeEntry72h",
  "outboundFreeEntry72h",
  "inboundOutsideWindow",
  "outboundOutsideWindow",
] as const satisfies readonly MessageWindowBucket[];

export interface MessageWindowDayCounts {
  inboundService24h: number;
  outboundService24h: number;
  inboundFreeEntry72h: number;
  outboundFreeEntry72h: number;
  inboundOutsideWindow: number;
  outboundOutsideWindow: number;
}

export interface MessageWindowDailyPoint extends MessageWindowDayCounts {
  date: string;
  total: number;
}

export interface MessageWindowReport {
  from: string;
  to: string;
  botId?: string;
  totals: MessageWindowDayCounts & { total: number };
  daily: MessageWindowDailyPoint[];
}

function emptyCounts(): MessageWindowDayCounts {
  return {
    inboundService24h: 0,
    outboundService24h: 0,
    inboundFreeEntry72h: 0,
    outboundFreeEntry72h: 0,
    inboundOutsideWindow: 0,
    outboundOutsideWindow: 0,
  };
}

function totalOf(counts: MessageWindowDayCounts): number {
  return MESSAGE_WINDOW_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);
}

function tenantPk(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

function tenantDailySk(date: string): string {
  return `MSG_WINDOW#${date}`;
}

function botDailySk(date: string, botId: string): string {
  return `MSG_WINDOW#${date}#BOT#${botId}`;
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

function mapItemCounts(item: Record<string, unknown>): MessageWindowDayCounts {
  const counts = emptyCounts();
  for (const bucket of MESSAGE_WINDOW_BUCKETS) {
    counts[bucket] = Number(item[bucket]) || 0;
  }
  return counts;
}

export function assembleMessageWindowReport(
  items: Array<Record<string, unknown>>,
  range: { from: string; to: string },
  botId?: string
): MessageWindowReport {
  const byDate = new Map<string, MessageWindowDayCounts>();
  for (const item of items) {
    const sk = String(item.SK ?? "");
    if (botId) {
      if (!sk.startsWith("MSG_WINDOW#") || !sk.endsWith(`#BOT#${botId}`)) continue;
    } else if (!/^MSG_WINDOW#\d{4}-\d{2}-\d{2}$/.test(sk)) {
      continue;
    }

    const date =
      typeof item.date === "string" && item.date
        ? item.date
        : sk.replace(/^MSG_WINDOW#/, "").slice(0, 10);
    if (!date || date < range.from || date > range.to) continue;
    byDate.set(date, mapItemCounts(item));
  }

  const daily: MessageWindowDailyPoint[] = eachDateInclusive(range.from, range.to).map((date) => {
    const counts = byDate.get(date) ?? emptyCounts();
    return {
      date,
      ...counts,
      total: totalOf(counts),
    };
  });

  const totals = emptyCounts();
  for (const point of daily) {
    for (const bucket of MESSAGE_WINDOW_BUCKETS) {
      totals[bucket] += point[bucket];
    }
  }

  return {
    from: range.from,
    to: range.to,
    ...(botId ? { botId } : {}),
    totals: { ...totals, total: totalOf(totals) },
    daily,
  };
}

async function incrementDailyItem(
  tenantId: string,
  sk: string,
  date: string,
  bucket: MessageWindowBucket
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

export async function incrementMessageWindowCount(
  tenantId: string,
  botId: string,
  bucket: MessageWindowBucket,
  at = new Date()
): Promise<void> {
  const date = formatDateUtc(at);
  await Promise.all([
    incrementDailyItem(tenantId, tenantDailySk(date), date, bucket),
    incrementDailyItem(tenantId, botDailySk(date, botId), date, bucket),
  ]);
}

export async function getMessageWindowReport(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<MessageWindowReport> {
  const range = resolveMetricsDateRange(options);
  const botId = options.botId?.trim() || undefined;
  const items: Array<Record<string, unknown>> = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
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
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      })
    );
    items.push(...((result.Items ?? []) as Array<Record<string, unknown>>));
    exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return assembleMessageWindowReport(items, range, botId);
}
