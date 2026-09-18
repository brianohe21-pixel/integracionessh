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
  SmsOverview,
} from "../../types/index.js";

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

export async function getSmsOverview(tenantId: string): Promise<SmsOverview> {
  const [bots, campaigns, bulkJobs, receipts] = await Promise.all([
    listBots(tenantId),
    listCampaigns(tenantId, 200),
    listBulkJobs(tenantId, 200),
    listAllSmsDlrReceipts(tenantId),
  ]);

  const smsCampaigns = campaigns.filter((campaign) => campaign.channel === "sms");
  const smsBulkJobs = bulkJobs.filter((job) => job.channel === "sms");
  const dlrCounts = countDlrStatuses(receipts);

  const activeCampaigns = smsCampaigns.filter(
    (campaign) =>
      campaign.status === "running" ||
      campaign.status === "scheduled" ||
      campaign.status === "paused"
  ).length;

  return {
    enabledBots: bots.filter((bot) => bot.smsEnabled).length,
    activeCampaigns,
    campaignSent: smsCampaigns.reduce((sum, campaign) => sum + campaign.sent, 0),
    campaignFailed: smsCampaigns.reduce((sum, campaign) => sum + campaign.failed, 0),
    campaignDelivered: smsCampaigns.reduce((sum, campaign) => sum + campaign.deliveredCount, 0),
    campaignDeliveryFailed: smsCampaigns.reduce(
      (sum, campaign) => sum + campaign.deliveryFailed,
      0
    ),
    bulkJobs: smsBulkJobs.length,
    bulkSent: smsBulkJobs.reduce((sum, job) => sum + job.sent, 0),
    bulkFailed: smsBulkJobs.reduce((sum, job) => sum + job.failed, 0),
    dlrDelivered: dlrCounts.delivered,
    dlrFailed: dlrCounts.failed,
    dlrPending: dlrCounts.pending,
    dlrSent: dlrCounts.sent,
    deliveryRate: dlrCounts.deliveryRate,
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
