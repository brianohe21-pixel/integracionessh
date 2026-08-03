import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  getCampaign,
  incrementCampaignProgress,
  markRecipientSent,
  saveCampaignMessageTracking,
  listPendingRecipients,
  setCampaignNextBatchAt,
} from "../../lib/dynamodb/campaign.repository.js";
import { parseSendFailureError, saveBulkSendFailure } from "../../lib/dynamodb/bulk-job.repository.js";
import { getContactByPhone } from "../../lib/dynamodb/contact.repository.js";
import { sendTemplateMessage, getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import { sendSmsFromTemplate } from "../../lib/sms/send-outbound.js";
import type { CampaignSQSBody } from "../../types/index.js";
import { computeNextBatchAt } from "../../lib/campaign/batch.js";
import {
  createCampaignBatchSchedule,
  deleteCampaignBatchSchedule,
} from "../../lib/campaign/scheduler.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: CampaignSQSBody;

  try {
    body = JSON.parse(record.body) as CampaignSQSBody;
  } catch {
    console.error("Failed to parse campaign SQS message", record.body);
    return;
  }

  if (body.kind === "batch-complete") {
    await processBatchComplete(body);
    return;
  }

  await processRecipient(body);
}

async function processBatchComplete(body: CampaignSQSBody): Promise<void> {
  const { campaignId, tenantId, batchVersion, batchIndex } = body;
  if (batchVersion === undefined || batchIndex === undefined) return;

  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) return;
  if (campaign.status !== "running") return;
  if ((campaign.batchVersion ?? 1) !== batchVersion) {
    console.log(`Stale batch-complete for campaign ${campaignId}, skipping`);
    return;
  }
  if (!campaign.batchConfig) return;

  const pending = await listPendingRecipients(tenantId, campaignId, 1);
  if (pending.length === 0) return;

  const nextRunAt = computeNextBatchAt(campaign.batchConfig.delaySeconds);
  await deleteCampaignBatchSchedule(campaignId);
  await setCampaignNextBatchAt(tenantId, campaignId, nextRunAt.toISOString());
  await createCampaignBatchSchedule(
    campaignId,
    tenantId,
    nextRunAt,
    batchVersion
  );
}

async function processRecipient(body: CampaignSQSBody): Promise<void> {
  const {
    campaignId,
    tenantId,
    botId,
    templateName,
    language,
    to,
    components,
    recipientKey,
    batchVersion,
    channel = "whatsapp",
  } = body;

  if (!to) {
    console.warn("Campaign recipient message missing phone number");
    return;
  }

  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) {
    console.warn(`Campaign not found: ${campaignId}, skipping`);
    return;
  }

  if (campaign.status === "paused" || campaign.status === "cancelled") {
    console.log(`Campaign ${campaignId} is ${campaign.status}, skipping recipient ${to}`);
    return;
  }

  if (campaign.status === "completed" || campaign.status === "failed") {
    console.log(`Campaign ${campaignId} already finished, skipping`);
    return;
  }

  if (campaign.batchConfig && batchVersion !== undefined) {
    if ((campaign.batchVersion ?? 1) !== batchVersion) {
      console.log(`Stale batch version for campaign ${campaignId}, skipping recipient ${to}`);
      return;
    }
  }

  const normalizedTo = to.replace(/\D/g, "");

  if (campaign.requireOptIn) {
    const contact = await getContactByPhone(tenantId, normalizedTo);
    if (
      !contact ||
      contact.suppressed ||
      contact.marketingConsent !== "opt_in"
    ) {
      await saveBulkSendFailure({
        jobId: campaignId,
        tenantId,
        kind: "compliance",
        to: normalizedTo,
        errorMessage: "Recipient not eligible for marketing",
      });
      await incrementCampaignProgress(tenantId, campaignId, "failed");
      return;
    }
  }

  try {
    const bot = await getBot(tenantId, botId);

    if (!bot) {
      console.error(`Bot not found: ${botId}`);
      await saveBulkSendFailure({
        jobId: campaignId,
        tenantId,
        kind: "send",
        to,
        errorMessage: "Bot not found",
      });
      await incrementCampaignProgress(tenantId, campaignId, "failed");
      return;
    }

    if (channel === "sms") {
      const result = await sendSmsFromTemplate({
        tenantId,
        bot,
        botId,
        templateName,
        language,
        to,
        ...(components ? { components } : {}),
        environment: ENVIRONMENT,
      });

      await saveCampaignMessageTracking(result.messageId, campaignId, tenantId, to, recipientKey).catch(
        (err) => console.warn(`Failed to save campaign message tracking for ${result.messageId}:`, err)
      );
    } else {
      const accessToken = await getWhatsAppAccessToken(tenantId, ENVIRONMENT);
      const result = await sendTemplateMessage({
        phoneNumberId: bot.phoneNumberId,
        to,
        templateName,
        language,
        ...(components ? { components } : {}),
        accessToken,
      });

      const messageId = result.messages?.[0]?.id;
      if (messageId) {
        await saveCampaignMessageTracking(messageId, campaignId, tenantId, to, recipientKey).catch(
          (err) => console.warn(`Failed to save campaign message tracking for ${messageId}:`, err)
        );
      }
    }

    if (recipientKey) {
      await markRecipientSent(tenantId, recipientKey).catch((err) =>
        console.warn(`Failed to mark recipient sent ${recipientKey}:`, err)
      );
    }

    await incrementCampaignProgress(tenantId, campaignId, "sent");
  } catch (error) {
    console.error(`Campaign send failed for campaign=${campaignId} to=${to}:`, error);
    await saveBulkSendFailure({
      jobId: campaignId,
      tenantId,
      kind: "send",
      to,
      ...parseSendFailureError(error),
    });
    await incrementCampaignProgress(tenantId, campaignId, "failed");
  }
}
