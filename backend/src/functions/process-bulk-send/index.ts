import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { incrementBulkJobProgress } from "../../lib/dynamodb/bulk-job.repository.js";
import { sendTemplateMessage, getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import type { BulkSendSQSBody } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

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

  const { jobId, tenantId, botId, templateName, language, to, components } = body;

  try {
    const [bot, accessToken] = await Promise.all([
      getBot(tenantId, botId),
      getWhatsAppAccessToken(tenantId, ENVIRONMENT),
    ]);

    if (!bot) {
      console.error(`Bot not found: ${botId}`);
      await incrementBulkJobProgress(tenantId, jobId, "failed");
      return;
    }

    await sendTemplateMessage({
      phoneNumberId: bot.phoneNumberId,
      to,
      templateName,
      language,
      ...(components ? { components } : {}),
      accessToken,
    });

    await incrementBulkJobProgress(tenantId, jobId, "sent");
  } catch (error) {
    console.error(`Bulk send failed for job=${jobId} to=${to}:`, error);
    await incrementBulkJobProgress(tenantId, jobId, "failed");
  }
}
