import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  getCampaign,
  incrementCampaignProgress,
  saveCampaignMessageTracking,
} from "../../lib/dynamodb/campaign.repository.js";
import { parseSendFailureError, saveBulkSendFailure } from "../../lib/dynamodb/bulk-job.repository.js";
import { getContactByPhone } from "../../lib/dynamodb/contact.repository.js";
import { sendTemplateMessage, getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import type { CampaignSQSBody } from "../../types/index.js";

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

  const { campaignId, tenantId, botId, templateName, language, to, components } = body;

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
    const [bot, accessToken] = await Promise.all([
      getBot(tenantId, botId),
      getWhatsAppAccessToken(tenantId, ENVIRONMENT),
    ]);

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
      await saveCampaignMessageTracking(messageId, campaignId, tenantId, to).catch((err) =>
        console.warn(`Failed to save campaign message tracking for ${messageId}:`, err)
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
