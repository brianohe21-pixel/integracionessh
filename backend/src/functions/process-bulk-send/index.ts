import type { SQSEvent, SQSRecord } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  incrementBulkJobProgress,
  parseSendFailureError,
  recordBulkSendFailure,
  saveMessageTracking,
} from "../../lib/dynamodb/bulk-job.repository.js";
import { sendTemplateMessage, getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import { applyCoexistenceSendThrottle } from "../../lib/whatsapp/coexistence/throughput.js";
import { sendSmsFromTemplate } from "../../lib/sms/send-outbound.js";
import type { BulkSendSQSBody } from "../../types/index.js";
import { evaluateLaw2300ForTenant } from "../../lib/compliance/law2300-tenant.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const BULK_QUEUE_URL = process.env.BULK_SQS_QUEUE_URL ?? "";
const sqs = new SQSClient({});

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: BulkSendSQSBody;

  try {
    body = JSON.parse(record.body) as BulkSendSQSBody;
  } catch {
    console.error("Failed to parse bulk SQS message", record.body);
    return;
  }

  const { jobId, tenantId, botId, templateName, language, to, components, channel = "whatsapp" } = body;

  const law2300 = await evaluateLaw2300ForTenant(tenantId);
  if (!law2300.allowed) {
    const secondsUntilWindow = law2300.nextWindowAt
      ? Math.max(1, Math.floor((law2300.nextWindowAt.getTime() - Date.now()) / 1000))
      : 900;
    const delaySeconds = Math.min(900, secondsUntilWindow);
    if (BULK_QUEUE_URL) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: BULK_QUEUE_URL,
          MessageBody: record.body,
          MessageGroupId: jobId,
          MessageDeduplicationId: `${jobId}-${to}-${delaySeconds}-${Date.now()}`.slice(0, 128),
          DelaySeconds: delaySeconds,
        })
      );
    }
    return;
  }

  try {
    const bot = await getBot(tenantId, botId);

    if (!bot) {
      console.error(`Bot not found: ${botId}`);
      await recordBulkSendFailure(tenantId, jobId, "send", {
        to,
        errorMessage: "Bot no encontrado",
      });
      await incrementBulkJobProgress(tenantId, jobId, "failed");
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

      await saveMessageTracking(result.messageId, jobId, tenantId, to).catch((err) =>
        console.warn(`Failed to save message tracking for ${result.messageId}:`, err)
      );
      await incrementBulkJobProgress(tenantId, jobId, "sent");
      return;
    }

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
      await saveMessageTracking(messageId, jobId, tenantId, to).catch((err) =>
        console.warn(`Failed to save message tracking for ${messageId}:`, err)
      );
    }

    await incrementBulkJobProgress(tenantId, jobId, "sent");
  } catch (error) {
    console.error(`Bulk send failed for job=${jobId} to=${to}:`, error);
    await recordBulkSendFailure(tenantId, jobId, "send", {
      to,
      ...parseSendFailureError(error),
    });
    await incrementBulkJobProgress(tenantId, jobId, "failed");
  }
}
