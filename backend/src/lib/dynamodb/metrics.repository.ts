import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { listBots } from "./bot.repository.js";
import { listCachedTemplates } from "./template.repository.js";
import type {
  BulkSendJob,
  BotUsageMetrics,
  Conversation,
  UsageMetrics,
} from "../../types/index.js";

async function queryAll<T>(
  pk: string,
  skPrefix: string,
  mapItem: (item: Record<string, unknown>) => T
): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":sk": skPrefix,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      items.push(mapItem(item));
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

export async function listAllConversationsForBot(
  tenantId: string,
  botId: string
): Promise<Conversation[]> {
  return queryAll(
    `TENANT#${tenantId}#BOT#${botId}`,
    "CONV#",
    (item) => {
      const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
      return rest as unknown as Conversation;
    }
  );
}

export async function listAllBulkJobs(tenantId: string): Promise<BulkSendJob[]> {
  const jobs = await queryAll(`TENANT#${tenantId}`, "BULKJOB#", (item) => {
    const { PK, SK, ...rest } = item;
    return rest as unknown as BulkSendJob;
  });

  return jobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function maxIsoDate(dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => !!d);
  if (valid.length === 0) return null;
  return valid.reduce((max, d) => (d > max ? d : max));
}

export async function getTenantUsageMetrics(tenantId: string): Promise<UsageMetrics> {
  const [bots, bulkJobs] = await Promise.all([
    listBots(tenantId),
    listAllBulkJobs(tenantId),
  ]);

  const byBot: BotUsageMetrics[] = [];
  let totalConversations = 0;
  let activeConversations = 0;
  let totalMessages = 0;
  let totalTemplates = 0;
  const activityDates: (string | null)[] = [];

  await Promise.all(
    bots.map(async (bot) => {
      const [conversations, templates] = await Promise.all([
        listAllConversationsForBot(tenantId, bot.botId),
        listCachedTemplates(tenantId, bot.botId),
      ]);

      const botMessages = conversations.reduce((sum, c) => sum + (c.messageCount ?? 0), 0);
      const botActive = conversations.filter((c) => c.status === "active").length;
      const botLastActivity = maxIsoDate(conversations.map((c) => c.lastMessageAt));

      totalConversations += conversations.length;
      activeConversations += botActive;
      totalMessages += botMessages;
      totalTemplates += templates.length;
      if (botLastActivity) activityDates.push(botLastActivity);

      byBot.push({
        botId: bot.botId,
        botName: bot.name,
        status: bot.status,
        conversations: conversations.length,
        activeConversations: botActive,
        messages: botMessages,
        templates: templates.length,
        lastActivityAt: botLastActivity,
      });
    })
  );

  byBot.sort((a, b) => b.messages - a.messages);

  const bulkMessagesSent = bulkJobs.reduce((sum, j) => sum + j.sent, 0);
  const bulkMessagesFailed = bulkJobs.reduce((sum, j) => sum + j.failed, 0);
  const bulkActivity = maxIsoDate(bulkJobs.map((j) => j.updatedAt));

  return {
    summary: {
      totalBots: bots.length,
      activeBots: bots.filter((b) => b.status === "active").length,
      totalConversations,
      activeConversations,
      totalMessages,
      totalTemplates,
      bulkJobsCount: bulkJobs.length,
      bulkMessagesSent,
      bulkMessagesFailed,
      lastActivityAt: maxIsoDate([...activityDates, bulkActivity]),
    },
    byBot,
    recentBulkJobs: bulkJobs.slice(0, 10),
  };
}
