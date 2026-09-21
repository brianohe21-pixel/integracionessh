import { listBots } from "./bot.repository.js";
import { listBulkJobs } from "./bulk-job.repository.js";
import { listCampaigns } from "./campaign.repository.js";
import {
  listAllSmsDlrReceipts,
  listSmsDlrReceipts,
  type ListSmsDlrReceiptsOptions,
} from "./sms-dlr.repository.js";
import { deriveSmsTraceStatus } from "../sms/traceability.js";
import type {
  SmsDlrReceipt,
  SmsHistoryItem,
  SmsHistoryPage,
  SmsHistoryStatus,
  SmsOverview,
  SmsOverviewCharts,
  SmsOverviewChannelPoint,
  SmsOverviewDailyPoint,
  SmsOverviewSourcePoint,
  SmsOverviewStatusPoint,
} from "../../types/index.js";

export interface SmsOverviewOptions {
  from?: string;
  to?: string;
}

function matchesDateRange(isoDate: string, from?: string, to?: string): boolean {
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

function mapReceiptToHistoryItem(receipt: SmsDlrReceipt): SmsHistoryItem {
  const status = deriveSmsTraceStatus(receipt);
  return {
    receiptId: receipt.receiptId,
    to: receipt.to,
    source: receipt.source,
    status,
    templateName: receipt.templateName ?? null,
    campaignId: receipt.campaignId ?? null,
    botId: receipt.botId,
    createdAt: receipt.createdAt,
    dlrAt: receipt.dlrAt ?? null,
    telcoredMessageId: receipt.telcoredMessageId ?? null,
    sendError: receipt.sendError ?? null,
  };
}

function countDlrStatuses(receipts: SmsDlrReceipt[]) {
  let delivered = 0;
  let failed = 0;
  let pending = 0;
  let sent = 0;

  for (const receipt of receipts) {
    const status = deriveSmsTraceStatus(receipt);
    if (status === "delivered") delivered += 1;
    else if (status === "delivery_failed" || status === "send_failed") failed += 1;
    else if (status === "sent") sent += 1;
    else pending += 1;
  }

  const finalized = delivered + failed;
  const deliveryRate = finalized > 0 ? delivered / finalized : 0;

  return { delivered, failed, pending, sent, deliveryRate };
}

const SMS_HISTORY_STATUSES: SmsHistoryStatus[] = [
  "pending",
  "sent",
  "delivered",
  "delivery_failed",
  "send_failed",
];

const SMS_DLR_SOURCES: SmsOverviewSourcePoint["source"][] = ["api", "campaign", "template"];

function buildDailyTrend(receipts: SmsDlrReceipt[]): SmsOverviewDailyPoint[] {
  const buckets = new Map<string, { total: number; delivered: number; failed: number }>();

  for (const receipt of receipts) {
    const date = receipt.createdAt.slice(0, 10);
    const bucket = buckets.get(date) ?? { total: 0, delivered: 0, failed: 0 };
    bucket.total += 1;
    const status = deriveSmsTraceStatus(receipt);
    if (status === "delivered") bucket.delivered += 1;
    else if (status === "delivery_failed" || status === "send_failed") bucket.failed += 1;
    buckets.set(date, bucket);
  }

  const dates = [...buckets.keys()].sort();
  const limitedDates = dates.length > 30 ? dates.slice(-30) : dates;

  return limitedDates.map((date) => ({
    date,
    total: buckets.get(date)?.total ?? 0,
    delivered: buckets.get(date)?.delivered ?? 0,
    failed: buckets.get(date)?.failed ?? 0,
  }));
}

function buildByStatus(receipts: SmsDlrReceipt[]): SmsOverviewStatusPoint[] {
  const counts = new Map<SmsHistoryStatus, number>();
  for (const status of SMS_HISTORY_STATUSES) {
    counts.set(status, 0);
  }

  for (const receipt of receipts) {
    const status = deriveSmsTraceStatus(receipt);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return SMS_HISTORY_STATUSES.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  })).filter((item) => item.count > 0);
}

function buildBySource(receipts: SmsDlrReceipt[]): SmsOverviewSourcePoint[] {
  const counts = new Map<SmsOverviewSourcePoint["source"], number>();
  for (const source of SMS_DLR_SOURCES) {
    counts.set(source, 0);
  }

  for (const receipt of receipts) {
    counts.set(receipt.source, (counts.get(receipt.source) ?? 0) + 1);
  }

  return SMS_DLR_SOURCES.map((source) => ({
    source,
    count: counts.get(source) ?? 0,
  })).filter((item) => item.count > 0);
}

function buildByChannel(
  campaignSent: number,
  campaignFailed: number,
  bulkSent: number,
  bulkFailed: number
): SmsOverviewChannelPoint[] {
  const points: SmsOverviewChannelPoint[] = [];
  if (campaignSent > 0 || campaignFailed > 0) {
    points.push({ channel: "campaign", sent: campaignSent, failed: campaignFailed });
  }
  if (bulkSent > 0 || bulkFailed > 0) {
    points.push({ channel: "bulk", sent: bulkSent, failed: bulkFailed });
  }
  return points;
}

function buildSmsOverviewCharts(
  receipts: SmsDlrReceipt[],
  campaignSent: number,
  campaignFailed: number,
  bulkSent: number,
  bulkFailed: number
): SmsOverviewCharts {
  return {
    dailyTrend: buildDailyTrend(receipts),
    byStatus: buildByStatus(receipts),
    bySource: buildBySource(receipts),
    byChannel: buildByChannel(campaignSent, campaignFailed, bulkSent, bulkFailed),
  };
}

export async function getSmsOverview(
  tenantId: string,
  options: SmsOverviewOptions = {}
): Promise<SmsOverview> {
  const { from, to } = options;
  const [bots, campaigns, bulkJobs, receipts] = await Promise.all([
    listBots(tenantId),
    listCampaigns(tenantId, 200),
    listBulkJobs(tenantId, 200),
    listAllSmsDlrReceipts(tenantId, { ...(from ? { from } : {}), ...(to ? { to } : {}) }),
  ]);

  const smsCampaigns = campaigns.filter(
    (campaign) =>
      campaign.channel === "sms" && matchesDateRange(campaign.createdAt, from, to)
  );
  const smsBulkJobs = bulkJobs.filter(
    (job) => job.channel === "sms" && matchesDateRange(job.createdAt, from, to)
  );
  const dlrCounts = countDlrStatuses(receipts);

  const activeCampaigns = smsCampaigns.filter(
    (campaign) =>
      campaign.status === "running" ||
      campaign.status === "scheduled" ||
      campaign.status === "paused"
  ).length;

  const campaignSent = smsCampaigns.reduce((sum, campaign) => sum + campaign.sent, 0);
  const campaignFailed = smsCampaigns.reduce((sum, campaign) => sum + campaign.failed, 0);
  const bulkSent = smsBulkJobs.reduce((sum, job) => sum + job.sent, 0);
  const bulkFailed = smsBulkJobs.reduce((sum, job) => sum + job.failed, 0);

  return {
    enabledBots: bots.filter((bot) => bot.smsEnabled).length,
    activeCampaigns,
    campaignSent,
    campaignFailed,
    campaignDelivered: smsCampaigns.reduce((sum, campaign) => sum + campaign.deliveredCount, 0),
    campaignDeliveryFailed: smsCampaigns.reduce(
      (sum, campaign) => sum + campaign.deliveryFailed,
      0
    ),
    bulkJobs: smsBulkJobs.length,
    bulkSent,
    bulkFailed,
    dlrDelivered: dlrCounts.delivered,
    dlrFailed: dlrCounts.failed,
    dlrPending: dlrCounts.pending,
    dlrSent: dlrCounts.sent,
    deliveryRate: dlrCounts.deliveryRate,
    charts: buildSmsOverviewCharts(receipts, campaignSent, campaignFailed, bulkSent, bulkFailed),
  };
}

export async function getSmsHistoryPage(
  tenantId: string,
  options: ListSmsDlrReceiptsOptions = {}
): Promise<SmsHistoryPage> {
  const page = await listSmsDlrReceipts(tenantId, options);
  return {
    items: page.items.map(mapReceiptToHistoryItem),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}
