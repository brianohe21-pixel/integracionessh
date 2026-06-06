import { listCampaigns } from "./campaign.repository.js";
import { listAllBulkJobs } from "./metrics.repository.js";
import { listBots } from "./bot.repository.js";
import { listAllConversationsForBot } from "./metrics.repository.js";
import type { Campaign, MarketingMetrics } from "../../types/index.js";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

export async function getMarketingMetrics(tenantId: string): Promise<MarketingMetrics> {
  const [campaigns, bulkJobs, bots] = await Promise.all([
    listCampaigns(tenantId, 200),
    listAllBulkJobs(tenantId),
    listBots(tenantId),
  ]);

  const aggregates = campaigns.reduce(
    (acc, c) => ({
      totalRecipients: acc.totalRecipients + c.total,
      sent: acc.sent + c.sent,
      delivered: acc.delivered + c.deliveredCount,
      read: acc.read + c.readCount,
      deliveryFailed: acc.deliveryFailed + c.deliveryFailed,
    }),
    { totalRecipients: 0, sent: 0, delivered: 0, read: 0, deliveryFailed: 0 }
  );

  const active = campaigns.filter((c) =>
    ["running", "scheduled", "paused", "draft"].includes(c.status)
  ).length;
  const completed = campaigns.filter((c) =>
    ["completed", "failed", "cancelled"].includes(c.status)
  ).length;

  const bulkSent = bulkJobs.reduce((s, j) => s + j.sent, 0);
  const bulkFailed = bulkJobs.reduce((s, j) => s + j.failed, 0);

  const topCampaigns = [...campaigns]
    .filter((c) => c.sent > 0)
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 5)
    .map((c: Campaign) => ({
      campaignId: c.campaignId,
      name: c.name,
      sent: c.sent,
      deliveredCount: c.deliveredCount,
      readCount: c.readCount,
      deliveryRate: rate(c.deliveredCount, c.sent),
      readRate: rate(c.readCount, c.sent),
    }));

  let inboxOpen = 0;
  let inboxPending = 0;
  let resolvedToday = 0;

  await Promise.all(
    bots.map(async (bot) => {
      const conversations = await listAllConversationsForBot(tenantId, bot.botId);
      for (const c of conversations) {
        if ((c.handoffMode ?? "bot") !== "human") continue;
        const ws = c.workflowStatus ?? "open";
        if (ws === "open" || ws === "new") inboxOpen++;
        if (ws === "pending") inboxPending++;
        if (ws === "resolved" && c.resolvedAt && isToday(c.resolvedAt)) resolvedToday++;
      }
    })
  );

  return {
    campaigns: {
      total: campaigns.length,
      active,
      completed,
      aggregates,
      rates: {
        deliveryRate: rate(aggregates.delivered, aggregates.sent),
        readRate: rate(aggregates.read, aggregates.sent),
        failureRate: rate(aggregates.deliveryFailed, aggregates.sent),
        successRate: rate(aggregates.sent - aggregates.deliveryFailed, aggregates.totalRecipients),
      },
    },
    bulk: {
      jobsCount: bulkJobs.length,
      sent: bulkSent,
      failed: bulkFailed,
      rates: {
        successRate: rate(bulkSent, bulkSent + bulkFailed),
      },
    },
    topCampaigns,
    inbox: {
      open: inboxOpen,
      pending: inboxPending,
      resolvedToday,
    },
  };
}
