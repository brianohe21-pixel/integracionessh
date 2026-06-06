import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getAutomation } from "../../lib/dynamodb/automation.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { listContactsByTags } from "../../lib/dynamodb/contact.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanSendMessages } from "../../lib/billing/assert-plan.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import { checkMarketingRecipients } from "../../lib/compliance/recipient-policy.js";
import { sendTextMessage, sendTemplateMessage, getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: { tenantId: string; ruleId: string };
  try {
    body = JSON.parse(record.body) as { tenantId: string; ruleId: string };
  } catch {
    console.error("Invalid automation queue message", record.body);
    return;
  }

  const { tenantId, ruleId } = body;
  const rule = await getAutomation(tenantId, ruleId);
  if (!rule || !rule.enabled || rule.trigger !== "schedule") return;

  const bot = await getBot(tenantId, rule.botId);
  if (!bot) return;

  const tenant = await getTenant(tenantId);
  if (tenant) {
    try {
      await assertCanSendMessages(tenant);
    } catch {
      console.warn(`Plan limit for scheduled automation tenant=${tenantId}`);
      return;
    }
  }

  const accessToken = await getWhatsAppAccessToken(tenantId, ENVIRONMENT);
  let phones: string[] = [];

  if (rule.targetPhones?.length) {
    phones = rule.targetPhones.map((p) => p.replace(/\D/g, ""));
  } else if (rule.targetTags?.length) {
    const contacts = await listContactsByTags(tenantId, rule.targetTags);
    phones = contacts.map((c) => c.phoneNumber);
  }

  if (phones.length === 0) return;

  const { allowed } = await checkMarketingRecipients(tenantId, phones);
  const recipients = allowed.length > 0 ? allowed : phones;

  for (const to of recipients) {
    try {
      if (rule.action === "send_text" && rule.messageText) {
        await sendTextMessage({
          phoneNumberId: bot.phoneNumberId,
          to,
          text: rule.messageText,
          accessToken,
        });
      } else if (rule.action === "send_template" && rule.templateName && rule.templateLanguage) {
        await sendTemplateMessage({
          phoneNumberId: bot.phoneNumberId,
          to,
          templateName: rule.templateName,
          language: rule.templateLanguage,
          accessToken,
          ...(rule.templateVariables
            ? {
                components: [
                  {
                    type: "body",
                    parameters: Object.values(rule.templateVariables).map((text) => ({
                      type: "text" as const,
                      text,
                    })),
                  },
                ],
              }
            : {}),
        });
      }
      await incrementMessages(tenantId);
    } catch (err) {
      console.error(`Scheduled automation send failed to=${to}:`, err);
    }
  }
}
