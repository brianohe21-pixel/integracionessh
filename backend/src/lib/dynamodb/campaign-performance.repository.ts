import { listAllCampaigns } from "./campaign.repository.js";
import {
  isWithinDateRange,
  resolveMetricsDateRange,
} from "./call-metrics.js";
import type {
  Campaign,
  CampaignPerformanceReport,
  CampaignPerformanceRow,
  CampaignPerformanceTotals,
  CampaignTemplateAggregate,
} from "../../types/index.js";

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function emptyTotals(): CampaignPerformanceTotals {
  return {
    campaigns: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    deliveryFailed: 0,
    replies: 0,
    deliveryRate: 0,
    readRate: 0,
    replyRate: 0,
  };
}

function campaignReferenceAt(campaign: Campaign): string {
  return campaign.startedAt ?? campaign.createdAt;
}

function toRow(campaign: Campaign): CampaignPerformanceRow {
  const sent = campaign.sent ?? 0;
  const delivered = campaign.deliveredCount ?? 0;
  const read = campaign.readCount ?? 0;
  const failed = campaign.failed ?? 0;
  const deliveryFailed = campaign.deliveryFailed ?? 0;
  const replies = campaign.replyCount ?? 0;

  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    botId: campaign.botId,
    channel: campaign.channel ?? "whatsapp",
    templateName: campaign.templateName,
    language: campaign.language,
    status: campaign.status,
    createdAt: campaign.createdAt,
    ...(campaign.startedAt ? { startedAt: campaign.startedAt } : {}),
    ...(campaign.completedAt ? { completedAt: campaign.completedAt } : {}),
    total: campaign.total ?? 0,
    sent,
    delivered,
    read,
    failed,
    deliveryFailed,
    replies,
    deliveryRate: rate(delivered, sent),
    readRate: rate(read, sent),
    replyRate: rate(replies, sent),
  };
}

function finalizeTotals(totals: CampaignPerformanceTotals): CampaignPerformanceTotals {
  return {
    ...totals,
    deliveryRate: rate(totals.delivered, totals.sent),
    readRate: rate(totals.read, totals.sent),
    replyRate: rate(totals.replies, totals.sent),
  };
}

function aggregateByTemplate(
  rows: CampaignPerformanceRow[]
): CampaignTemplateAggregate[] {
  const buckets = new Map<string, CampaignTemplateAggregate>();

  for (const row of rows) {
    const key = `${row.templateName}::${row.language}`;
    const bucket = buckets.get(key) ?? {
      templateName: row.templateName,
      language: row.language,
      campaigns: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      deliveryFailed: 0,
      replies: 0,
      deliveryRate: 0,
      readRate: 0,
      replyRate: 0,
    };

    bucket.campaigns += 1;
    bucket.sent += row.sent;
    bucket.delivered += row.delivered;
    bucket.read += row.read;
    bucket.failed += row.failed;
    bucket.deliveryFailed += row.deliveryFailed;
    bucket.replies += row.replies;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      deliveryRate: rate(bucket.delivered, bucket.sent),
      readRate: rate(bucket.read, bucket.sent),
      replyRate: rate(bucket.replies, bucket.sent),
    }))
    .sort((a, b) => b.sent - a.sent || a.templateName.localeCompare(b.templateName));
}

export async function getCampaignPerformanceReport(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<CampaignPerformanceReport> {
  const { from, to } = resolveMetricsDateRange(options);
  const botId = options.botId?.trim() || undefined;
  const campaigns = await listAllCampaigns(tenantId);

  const rows = campaigns
    .filter((campaign) => {
      if (botId && campaign.botId !== botId) return false;
      const channel = campaign.channel ?? "whatsapp";
      if (channel !== "whatsapp") return false;
      return isWithinDateRange(campaignReferenceAt(campaign), from, to);
    })
    .map(toRow)
    .sort((a, b) => {
      const aAt = a.startedAt ?? a.createdAt;
      const bAt = b.startedAt ?? b.createdAt;
      return bAt.localeCompare(aAt);
    });

  const totals = emptyTotals();
  totals.campaigns = rows.length;
  for (const row of rows) {
    totals.sent += row.sent;
    totals.delivered += row.delivered;
    totals.read += row.read;
    totals.failed += row.failed;
    totals.deliveryFailed += row.deliveryFailed;
    totals.replies += row.replies;
  }

  return {
    from,
    to,
    ...(botId ? { botId } : {}),
    totals: finalizeTotals(totals),
    campaigns: rows,
    byTemplate: aggregateByTemplate(rows),
  };
}
