import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import {
  getCampaign,
  listPendingRecipients,
  initializeCampaignBatchState,
  updateCampaignBatchDispatch,
  clearCampaignNextBatchAt,
} from "../dynamodb/campaign.repository.js";
import { checkMarketingRecipients } from "../compliance/recipient-policy.js";
import type { Campaign, CampaignSQSBody } from "../../types/index.js";
import type { PendingRecipient as RepoPendingRecipient } from "../dynamodb/campaign.repository.js";

const sqs = new SQSClient({});
const CAMPAIGN_QUEUE_URL = process.env.CAMPAIGN_SQS_QUEUE_URL ?? "";
const SQS_BATCH_SIZE = 10;

export interface EnqueueBatchOptions {
  batchVersion?: number;
  batchIndex?: number;
  includeBatchComplete?: boolean;
}

async function filterPendingForMarketing(
  tenantId: string,
  pending: RepoPendingRecipient[],
  requireOptIn: boolean,
  actorUserId?: string
): Promise<RepoPendingRecipient[]> {
  if (!requireOptIn) return pending;

  const phones = pending.map((r) => r.to.replace(/\D/g, ""));
  const { allowed } = await checkMarketingRecipients(tenantId, phones, actorUserId);
  const allowedSet = new Set(allowed);
  return pending.filter((r) => allowedSet.has(r.to.replace(/\D/g, "")));
}

export async function enqueueRecipients(
  campaign: Pick<
    Campaign,
    "campaignId" | "tenantId" | "botId" | "templateName" | "language" | "channel"
  >,
  recipients: RepoPendingRecipient[],
  options?: EnqueueBatchOptions
): Promise<void> {
  const { campaignId, tenantId, botId, templateName, language, channel = "whatsapp" } = campaign;
  const BATCH_SIZE = SQS_BATCH_SIZE;
  let entryIndex = 0;

  const entries: Array<{
    Id: string;
    MessageBody: string;
    MessageGroupId: string;
    MessageDeduplicationId: string;
  }> = [];

  for (const recipient of recipients) {
    const body: CampaignSQSBody = {
      kind: "recipient",
      campaignId,
      tenantId,
      botId,
      channel,
      templateName,
      language,
      to: recipient.to.replace(/\D/g, ""),
      recipientKey: recipient.recipientKey,
      ...(options?.batchVersion !== undefined ? { batchVersion: options.batchVersion } : {}),
      ...(options?.batchIndex !== undefined ? { batchIndex: options.batchIndex } : {}),
    };
    if (recipient.components?.length) {
      body.components = recipient.components as NonNullable<CampaignSQSBody["components"]>;
    }
    const dedupId = `${campaignId}-${options?.batchIndex ?? 0}-${entryIndex}`;
    entryIndex++;
    entries.push({
      Id: dedupId.slice(0, 80),
      MessageBody: JSON.stringify(body),
      MessageGroupId: campaignId,
      MessageDeduplicationId: dedupId.slice(0, 128),
    });
  }

  if (options?.includeBatchComplete && options.batchVersion !== undefined && options.batchIndex !== undefined) {
    const controlBody: CampaignSQSBody = {
      kind: "batch-complete",
      campaignId,
      tenantId,
      botId,
      channel,
      templateName,
      language,
      batchVersion: options.batchVersion,
      batchIndex: options.batchIndex,
    };
    const dedupId = `${campaignId}-batch-complete-${options.batchIndex}`;
    entries.push({
      Id: dedupId.slice(0, 80),
      MessageBody: JSON.stringify(controlBody),
      MessageGroupId: campaignId,
      MessageDeduplicationId: dedupId.slice(0, 128),
    });
  }

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: CAMPAIGN_QUEUE_URL,
        Entries: batch,
      })
    );
  }
}

export interface DispatchBatchResult {
  dispatched: number;
  hasMorePending: boolean;
  batchIndex: number;
}

export async function dispatchCampaignBatch(
  tenantId: string,
  campaignId: string,
  expectedBatchVersion?: number,
  actorUserId?: string
): Promise<DispatchBatchResult | null> {
  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) return null;
  if (campaign.status !== "running") return null;

  const batchVersion = campaign.batchVersion ?? 1;
  if (expectedBatchVersion !== undefined && expectedBatchVersion !== batchVersion) {
    return null;
  }

  const batchSize = campaign.batchConfig?.size ?? 5000;
  const fetchLimit = campaign.batchConfig ? batchSize + 1 : batchSize;
  const pending = await listPendingRecipients(tenantId, campaignId, fetchLimit);
  const eligible = await filterPendingForMarketing(
    tenantId,
    pending,
    campaign.requireOptIn ?? false,
    actorUserId
  );

  const toDispatch = campaign.batchConfig ? eligible.slice(0, batchSize) : eligible;

  if (toDispatch.length === 0) {
    await clearCampaignNextBatchAt(tenantId, campaignId);
    return { dispatched: 0, hasMorePending: false, batchIndex: campaign.currentBatch ?? 0 };
  }

  const nextBatchIndex = (campaign.batchesDispatched ?? 0) + 1;
  const includeBatchComplete = Boolean(campaign.batchConfig);
  const hasMorePending = campaign.batchConfig ? eligible.length > batchSize : false;

  await enqueueRecipients(campaign, toDispatch, {
    batchVersion,
    batchIndex: nextBatchIndex,
    includeBatchComplete,
  });

  await updateCampaignBatchDispatch(tenantId, campaignId, {
    currentBatch: nextBatchIndex,
    batchesDispatched: nextBatchIndex,
    nextBatchAt: null,
  });

  return {
    dispatched: toDispatch.length,
    hasMorePending,
    batchIndex: nextBatchIndex,
  };
}

export async function startCampaignDispatch(
  tenantId: string,
  campaignId: string,
  botId: string,
  templateName: string,
  language: string,
  requireOptIn: boolean,
  actorUserId?: string
): Promise<void> {
  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) return;

  if (campaign.batchConfig) {
    await initializeCampaignBatchState(tenantId, campaignId);
    await dispatchCampaignBatch(tenantId, campaignId, 1, actorUserId);
    return;
  }

  const pending = await listPendingRecipients(tenantId, campaignId, 5000);
  const eligible = await filterPendingForMarketing(tenantId, pending, requireOptIn, actorUserId);
  await enqueueRecipients(
    { campaignId, tenantId, botId, templateName, language, channel: campaign.channel ?? "whatsapp" },
    eligible
  );
}
