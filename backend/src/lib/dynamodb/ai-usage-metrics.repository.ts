import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { formatDateUtc, resolveMetricsDateRange } from "./call-metrics.js";
import { listBots } from "./bot.repository.js";
import {
  getMonthlyUsage,
  listMonthlyUsageInRange,
} from "./usage.repository.js";
import { getTenant } from "./tenant.repository.js";
import { resolveEffectivePlanLimits } from "../billing/plan-limits.js";
import { buildAiUsageSnapshot } from "../billing/ai-pack-billing.js";

export interface AiResponsesDailyPoint {
  date: string;
  responses: number;
}

export interface AiResponsesByBotRow {
  botId: string;
  botName: string;
  responses: number;
}

export interface AiResponsesPeriodRow {
  period: string;
  responses: number;
  planLimit: number;
  effectiveLimit: number;
  planUsed: number;
  bonusGranted: number;
  bonusUsed: number;
  remaining: number;
  percentUsed: number;
}

export interface AiResponsesQuota {
  period: string;
  planLimit: number;
  effectiveLimit: number;
  planUsed: number;
  bonusGranted: number;
  bonusUsed: number;
  bonusRemaining: number;
  totalUsed: number;
  remaining: number;
  percentUsed: number;
}

export interface AiResponsesReport {
  from: string;
  to: string;
  botId?: string;
  plan: string;
  quota: AiResponsesQuota;
  totals: { responses: number };
  daily: AiResponsesDailyPoint[];
  byBot: AiResponsesByBotRow[];
  periods: AiResponsesPeriodRow[];
}

function tenantPk(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

function tenantDailySk(date: string): string {
  return `AI_USAGE#${date}`;
}

function botDailySk(date: string, botId: string): string {
  return `AI_USAGE#${date}#BOT#${botId}`;
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

function percentUsed(used: number, limit: number): number {
  if (limit <= 0 || limit >= Number.MAX_SAFE_INTEGER / 2) return 0;
  return Math.round((used / limit) * 1000) / 10;
}

async function incrementDailyItem(
  tenantId: string,
  sk: string,
  date: string,
  count: number
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: tenantPk(tenantId),
        SK: sk,
      },
      UpdateExpression:
        "SET #date = if_not_exists(#date, :date), tenantId = :tenantId, updatedAt = :now ADD responses :inc",
      ExpressionAttributeNames: {
        "#date": "date",
      },
      ExpressionAttributeValues: {
        ":date": date,
        ":tenantId": tenantId,
        ":now": new Date().toISOString(),
        ":inc": count,
      },
    })
  );
}

export async function incrementAiUsage(
  tenantId: string,
  botId: string,
  count = 1,
  at = new Date()
): Promise<void> {
  const amount = Math.max(1, Math.floor(count));
  const date = formatDateUtc(at);
  await Promise.all([
    incrementDailyItem(tenantId, tenantDailySk(date), date, amount),
    incrementDailyItem(tenantId, botDailySk(date, botId), date, amount),
  ]);
}

export async function getAiResponsesReport(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<AiResponsesReport> {
  const range = resolveMetricsDateRange(options);
  const botId = options.botId?.trim() || undefined;
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  const limits = await resolveEffectivePlanLimits(tenant);
  const currentUsage = await getMonthlyUsage(tenantId);
  const currentSnapshot = buildAiUsageSnapshot(
    tenant,
    limits.maxMessagesPerMonth,
    currentUsage.messagesCount,
    currentUsage.period
  );
  const remaining = Math.max(
    0,
    currentSnapshot.effectiveLimit - currentSnapshot.totalUsed
  );

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

  const byDate = new Map<string, number>();
  const byBotId = new Map<string, number>();

  for (const item of result.Items ?? []) {
    const sk = String(item.SK ?? "");
    const responses = Number(item.responses) || 0;
    if (responses <= 0) continue;

    if (botId) {
      if (!sk.startsWith("AI_USAGE#") || !sk.endsWith(`#BOT#${botId}`)) continue;
      const date =
        typeof item.date === "string" && item.date
          ? item.date
          : sk.replace(/^AI_USAGE#/, "").slice(0, 10);
      if (!date || date < range.from || date > range.to) continue;
      byDate.set(date, (byDate.get(date) ?? 0) + responses);
      byBotId.set(botId, (byBotId.get(botId) ?? 0) + responses);
      continue;
    }

    const botMatch = /^AI_USAGE#(\d{4}-\d{2}-\d{2})#BOT#(.+)$/.exec(sk);
    if (botMatch) {
      const date = botMatch[1]!;
      const rowBotId = botMatch[2]!;
      if (date < range.from || date > range.to) continue;
      byBotId.set(rowBotId, (byBotId.get(rowBotId) ?? 0) + responses);
      continue;
    }

    if (!/^AI_USAGE#\d{4}-\d{2}-\d{2}$/.test(sk)) continue;
    const date =
      typeof item.date === "string" && item.date
        ? item.date
        : sk.replace(/^AI_USAGE#/, "").slice(0, 10);
    if (!date || date < range.from || date > range.to) continue;
    byDate.set(date, responses);
  }

  const daily: AiResponsesDailyPoint[] = eachDateInclusive(range.from, range.to).map(
    (date) => ({
      date,
      responses: byDate.get(date) ?? 0,
    })
  );

  const totals = {
    responses: daily.reduce((sum, point) => sum + point.responses, 0),
  };

  const bots = await listBots(tenantId);
  const botNameById = new Map(bots.map((bot) => [bot.botId, bot.name]));
  const byBot: AiResponsesByBotRow[] = [...byBotId.entries()]
    .map(([id, responses]) => ({
      botId: id,
      botName: botNameById.get(id) ?? id,
      responses,
    }))
    .sort((a, b) => b.responses - a.responses || a.botName.localeCompare(b.botName));

  const monthly = await listMonthlyUsageInRange(tenantId, range.from, range.to);
  const periods: AiResponsesPeriodRow[] = monthly.map((usage) => {
    const isCurrent = usage.period === currentSnapshot.period;
    const snapshot = isCurrent
      ? currentSnapshot
      : buildAiUsageSnapshot({}, limits.maxMessagesPerMonth, usage.messagesCount, usage.period);
    return {
      period: usage.period,
      responses: snapshot.totalUsed,
      planLimit: snapshot.planLimit,
      effectiveLimit: snapshot.effectiveLimit,
      planUsed: snapshot.planUsed,
      bonusGranted: snapshot.bonusGranted,
      bonusUsed: snapshot.bonusUsed,
      remaining: Math.max(0, snapshot.effectiveLimit - snapshot.totalUsed),
      percentUsed: percentUsed(snapshot.totalUsed, snapshot.effectiveLimit),
    };
  });

  return {
    from: range.from,
    to: range.to,
    ...(botId ? { botId } : {}),
    plan: tenant.plan ?? "free",
    quota: {
      period: currentSnapshot.period,
      planLimit: currentSnapshot.planLimit,
      effectiveLimit: currentSnapshot.effectiveLimit,
      planUsed: currentSnapshot.planUsed,
      bonusGranted: currentSnapshot.bonusGranted,
      bonusUsed: currentSnapshot.bonusUsed,
      bonusRemaining: currentSnapshot.bonusRemaining,
      totalUsed: currentSnapshot.totalUsed,
      remaining,
      percentUsed: percentUsed(
        currentSnapshot.totalUsed,
        currentSnapshot.effectiveLimit
      ),
    },
    totals,
    daily,
    byBot,
    periods,
  };
}
