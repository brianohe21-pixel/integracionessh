import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanSendMessages } from "../../lib/billing/assert-plan.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import { PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
} from "../../lib/dynamodb/conversation.repository.js";
import { generateChatResponse, getOpenAIApiKey } from "../../lib/openai/client.js";
import {
  sendTextMessage,
  markMessageAsRead,
  getWhatsAppAccessToken,
  truncateWhatsAppText,
} from "../../lib/whatsapp/client.js";
import { callCustomWebhook } from "../../lib/webhook/client.js";
import type { SQSMessageBody, Message } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  let body: SQSMessageBody;

  try {
    body = JSON.parse(record.body) as SQSMessageBody;
  } catch {
    console.error("Failed to parse SQS message body", record.body);
    return;
  }

  const { tenantId, botId, phoneNumberId, message, contact } = body;

  try {
    const [bot, accessToken] = await Promise.all([
      getBot(tenantId, botId),
      getWhatsAppAccessToken(tenantId, ENVIRONMENT),
    ]);

    if (!bot) {
      console.error(`Bot not found: tenantId=${tenantId} botId=${botId}`);
      return;
    }

    await markMessageAsRead(phoneNumberId, message.id, accessToken).catch(() => {
      // non-critical
    });

    const conversation = await getOrCreateConversation(
      tenantId,
      botId,
      message.from,
      contact.profile.name
    );

    const history = await getConversationMessages(tenantId, conversation.conversationId, 20);

    const userMessageText = message.text?.body ?? "";

    const now = new Date().toISOString();

    const userMessage: Message = {
      messageId: message.id,
      conversationId: conversation.conversationId,
      tenantId,
      role: "user",
      content: userMessageText,
      whatsappMessageId: message.id,
      timestamp: now,
    };

    const tenant = await getTenant(tenantId);
    if (tenant) {
      try {
        await assertCanSendMessages(tenant);
      } catch (err) {
        if (err instanceof PlanLimitError) {
          console.warn(`Plan limit for tenant ${tenantId}:`, err.message);
          return;
        }
        throw err;
      }
    }

    let aiResponse: string;
    if (bot.responseMode === "webhook" && bot.webhookUrl) {
      aiResponse = await callCustomWebhook(bot.webhookUrl, bot.webhookSecret, {
        message: userMessageText,
        from: message.from,
        conversationId: conversation.conversationId,
        botId,
        contact: { name: contact.profile.name },
      });
    } else {
      const openAIKey = await getOpenAIApiKey(tenantId, ENVIRONMENT);
      aiResponse = await generateChatResponse(bot, history, userMessageText, openAIKey);
    }

    const outboundText = truncateWhatsAppText(aiResponse);

    const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const aiTimestamp = new Date().toISOString();

    const assistantMessage: Message = {
      messageId: aiMessageId,
      conversationId: conversation.conversationId,
      tenantId,
      role: "assistant",
      content: outboundText,
      timestamp: aiTimestamp,
    };

    await addMessage(userMessage, botId);
    await addMessage(assistantMessage, botId);
    await incrementMessages(tenantId);

    await sendTextMessage({
      phoneNumberId,
      to: message.from,
      text: outboundText,
      accessToken,
      replyToMessageId: message.id,
    });

    console.log(
      `Processed message for tenant=${tenantId} bot=${botId} conversation=${conversation.conversationId}`
    );
  } catch (error) {
    console.error(
      `Failed to process message for tenant=${tenantId} bot=${botId}:`,
      error
    );
    throw error;
  }
}
