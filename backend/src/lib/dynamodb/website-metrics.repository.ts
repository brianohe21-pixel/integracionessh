import { createHash } from "crypto";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listBots } from "./bot.repository.js";
import {
  buildWebsiteMetrics,
  resolveWebsiteMetricsDateRange,
  type WebsiteDailyAggregate,
} from "./website-metrics.js";
import type { WebsiteMetrics } from "../../types/index.js";
import { formatDateUtc } from "./call-metrics.js";

export interface WebsitePageviewEvent {
  path: string;
  referrer?: string;
  visitorId: string;
  sessionId: string;
}

function tenantPk(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

function dailySk(date: string): string {
  return `WEBMETRICS#${date}`;
}

function visitorSk(date: string, visitorId: string): string {
  return `WEBMETRICS#${date}#VIS#${hashValue(visitorId)}`;
}

function sessionSk(date: string, sessionId: string): string {
  return `WEBMETRICS#${date}#SES#${hashValue(sessionId)}`;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function encodeMapKey(value: string): string {
  const trimmed = value.trim().slice(0, 200);
  if (!trimmed) return "_direct_";
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "_root_";
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed.slice(0, 200) : `/${trimmed.slice(0, 200)}`;
}

function normalizeReferrer(referrer: string | undefined): string {
  const trimmed = referrer?.trim();
  if (!trimmed) return "direct";
  try {
    const url = new URL(trimmed);
    return url.hostname || "direct";
  } catch {
    return trimmed.slice(0, 120) || "direct";
  }
}

function mapDailyItem(date: string, item: Record<string, unknown>): WebsiteDailyAggregate {
  return {
    date,
    pageviews: Number(item.pageviews) || 0,
    uniqueVisitors: Number(item.uniqueVisitors) || 0,
    sessions: Number(item.sessions) || 0,
    byBot: (item.byBot as Record<string, number>) ?? {},
    paths: (item.paths as Record<string, number>) ?? {},
    pathLabels: (item.pathLabels as Record<string, string>) ?? {},
    referrers: (item.referrers as Record<string, number>) ?? {},
    referrerLabels: (item.referrerLabels as Record<string, string>) ?? {},
  };
}

export async function recordWebsitePageview(
  tenantId: string,
  botId: string,
  event: WebsitePageviewEvent
): Promise<void> {
  const date = formatDateUtc(new Date());
  const path = normalizePath(event.path);
  const referrer = normalizeReferrer(event.referrer);
  const pathKey = encodeMapKey(path);
  const referrerKey = encodeMapKey(referrer);
  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: tenantPk(tenantId),
        SK: dailySk(date),
      },
      UpdateExpression: `
        SET pageviews = if_not_exists(pageviews, :zero) + :one,
            tenantId = :tenantId,
            #date = :date,
            updatedAt = :now,
            #byBot.#botId = if_not_exists(#byBot.#botId, :zero) + :one,
            #paths.#pathKey = if_not_exists(#paths.#pathKey, :zero) + :one,
            #pathLabels.#pathKey = :pathLabel,
            #referrers.#refKey = if_not_exists(#referrers.#refKey, :zero) + :one,
            #referrerLabels.#refKey = :referrerLabel
      `,
      ExpressionAttributeNames: {
        "#date": "date",
        "#byBot": "byBot",
        "#botId": botId,
        "#paths": "paths",
        "#pathKey": pathKey,
        "#pathLabels": "pathLabels",
        "#referrers": "referrers",
        "#refKey": referrerKey,
        "#referrerLabels": "referrerLabels",
      },
      ExpressionAttributeValues: {
        ":zero": 0,
        ":one": 1,
        ":tenantId": tenantId,
        ":date": date,
        ":now": now,
        ":pathLabel": path,
        ":referrerLabel": referrer,
      },
    })
  );

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: tenantPk(tenantId),
          SK: visitorSk(date, event.visitorId),
          tenantId,
          date,
          createdAt: now,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: tenantPk(tenantId),
          SK: dailySk(date),
        },
        UpdateExpression: "SET uniqueVisitors = if_not_exists(uniqueVisitors, :zero) + :one",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
        },
      })
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error;
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: tenantPk(tenantId),
          SK: sessionSk(date, event.sessionId),
          tenantId,
          date,
          createdAt: now,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: tenantPk(tenantId),
          SK: dailySk(date),
        },
        UpdateExpression: "SET sessions = if_not_exists(sessions, :zero) + :one",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
        },
      })
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error;
  }
}

async function listDailyAggregates(
  tenantId: string,
  from: string,
  to: string
): Promise<WebsiteDailyAggregate[]> {
  const items: WebsiteDailyAggregate[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": tenantPk(tenantId),
          ":sk": "WEBMETRICS#",
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      const sk = String(item.SK ?? "");
      if (!sk.startsWith("WEBMETRICS#")) continue;
      const parts = sk.split("#");
      if (parts.length !== 2) continue;
      const date = parts[1];
      if (date < from || date > to) continue;
      items.push(mapDailyItem(date, item));
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getWebsiteMetrics(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<WebsiteMetrics> {
  const range = resolveWebsiteMetricsDateRange(options);
  const [dailyRows, bots] = await Promise.all([
    listDailyAggregates(tenantId, range.from, range.to),
    listBots(tenantId),
  ]);
  const botNames = new Map(bots.map((bot) => [bot.botId, bot.name]));
  return buildWebsiteMetrics(dailyRows, range, botNames, options.botId?.trim() || undefined);
}
