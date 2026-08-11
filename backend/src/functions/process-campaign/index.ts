import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  getCampaign,
  incrementCampaignProgress,
  markRecipientSent,
  markRecipientFailed,
  saveCampaignMessageTracking,
  listPendingRecipients,
  setCampaignNextBatchAt,
} from "../../lib/dynamodb/campaign.repository.js";
import {
  parseSendFailureError,
  saveBulkSendFailure,
} from "../../lib/dynamodb/bulk-job.repository.js";
import {
  ensureCampaignSendAttempt,
  isCampaignSendAttemptTerminal,
  markCampaignSendAttemptFailed,
  markCampaignSendAttemptSent,
} from "../../lib/dynamodb/campaign-send-attempt.repository.js";
import { getContactByPhone } from "../../lib/dynamodb/contact.repository.js";
import { sendTemplateMessage, getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import { applyCoexistenceSendThrottle } from "../../lib/whatsapp/coexistence/throughput.js";
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

  await processRecipient(body, record.messageId);
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

async function processRecipient(body: CampaignSQSBody, sqsMessageId: string): Promise<void> {
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
    requestDlr,
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
  const attemptId = sqsMessageId;

  const { attempt, isNew } = await ensureCampaignSendAttempt({
    attemptId,
    tenantId,
    campaignId,
    to: normalizedTo,
    channel,
    templateName,
    language,
    ...(recipientKey ? { recipientKey } : {}),
    ...(batchVersion !== undefined ? { batchVersion } : {}),
    ...(body.batchIndex !== undefined ? { batchIndex: body.batchIndex } : {}),
  });

  if (!isNew && isCampaignSendAttemptTerminal(attempt.status)) {
    console.log(`Campaign attempt ${attemptId} already processed (${attempt.status}), skipping`);
    return;
  }

  if (campaign.requireOptIn) {
    const contact = await getContactByPhone(tenantId, normalizedTo);
    if (
      !contact ||
      contact.suppressed ||
      contact.marketingConsent !== "opt_in"
    ) {
      await markCampaignSendAttemptFailed(tenantId, campaignId, attemptId, {
        status: "compliance_blocked",
        failureKind: "compliance",
        sendErrorMessage: "Recipient not eligible for marketing",
      });
      await saveBulkSendFailure({
        jobId: campaignId,
        tenantId,
        kind: "compliance",
        to: normalizedTo,
        errorMessage: "Recipient not eligible for marketing",
        attemptId,
      });
      if (recipientKey) {
        await markRecipientFailed(tenantId, recipientKey).catch((err) =>
          console.warn(`Failed to mark recipient failed ${recipientKey}:`, err)
        );
      }
      await incrementCampaignProgress(tenantId, campaignId, "failed");
      return;
    }
  }

  try {
    const bot = await getBot(tenantId, botId);

    if (!bot) {
      console.error(`Bot not found: ${botId}`);
      await markCampaignSendAttemptFailed(tenantId, campaignId, attemptId, {
        status: "send_failed",
        failureKind: "send",
        sendErrorMessage: "Bot not found",
      });
      await saveBulkSendFailure({
        jobId: campaignId,
        tenantId,
        kind: "send",
        to,
        errorMessage: "Bot not found",
        attemptId,
      });
      if (recipientKey) {
        await markRecipientFailed(tenantId, recipientKey).catch((err) =>
          console.warn(`Failed to mark recipient failed ${recipientKey}:`, err)
        );
      }
      await incrementCampaignProgress(tenantId, campaignId, "failed");
      return;
    }

    if (channel === "sms") {
      const shouldRequestDlr = requestDlr ?? campaign.requestDlr ?? false;
      const result = await sendSmsFromTemplate({
        tenantId,
        bot,
        botId,
        templateName,
        language,
        to,
        ...(components ? { components } : {}),
        environment: ENVIRONMENT,
        ...(shouldRequestDlr
          ? { requestDlr: true, source: "campaign", campaignId }
          : {}),
        attemptId,
        ...(recipientKey ? { recipientKey } : {}),
      });

      await markCampaignSendAttemptSent(tenantId, campaignId, attemptId, {
        externalMessageId: result.messageId,
        telcoredMessageId: result.messageId,
        ...(result.receiptId ? { smsReceiptId: result.receiptId } : {}),
      });

      await saveCampaignMessageTracking(
        result.messageId,
        campaignId,
        tenantId,
        to,
        recipientKey,
        attemptId
      ).catch((err) =>
        console.warn(`Failed to save campaign message tracking for ${result.messageId}:`, err)
      );
    } else {
      await applyCoexistenceSendThrottle(bot.whatsappOnboardingMode);
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
        await markCampaignSendAttemptSent(tenantId, campaignId, attemptId, {
          externalMessageId: messageId,
          waMessageId: messageId,
        });
        await saveCampaignMessageTracking(
          messageId,
          campaignId,
          tenantId,
          to,
          recipientKey,
          attemptId
        ).catch((err) =>
          console.warn(`Failed to save campaign message tracking for ${messageId}:`, err)
        );
      } else {
        await markCampaignSendAttemptSent(tenantId, campaignId, attemptId, {});
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
    const parsed = parseSendFailureError(error);
    await markCampaignSendAttemptFailed(tenantId, campaignId, attemptId, {
      status: "send_failed",
      failureKind: "send",
      sendErrorMessage: parsed.errorMessage,
      ...(parsed.errorCode != null ? { sendErrorCode: parsed.errorCode } : {}),
      ...(parsed.errorTitle ? { sendErrorTitle: parsed.errorTitle } : {}),
    });
    await saveBulkSendFailure({
      jobId: campaignId,
      tenantId,
      kind: "send",
      to,
      attemptId,
      ...parsed,
    });
    if (recipientKey) {
      await markRecipientFailed(tenantId, recipientKey).catch((err) =>
        console.warn(`Failed to mark recipient failed ${recipientKey}:`, err)
      );
    }
    await incrementCampaignProgress(tenantId, campaignId, "failed");
  }
}
