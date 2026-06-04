import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanSendMessages } from "../../lib/billing/assert-plan.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import { PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  getOrCreateConversation,
  getConversation,
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
import { normalizeWhatsAppContact } from "../../lib/whatsapp/contact.js";
import { performHandoff } from "../../lib/advisor/handoff.js";
import {
  getClientHandoffMessage,
  notifyAdvisorOfConversation,
} from "../../lib/advisor/notify.js";
import type { SQSMessageBody, Message } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function sendHandoffCourtesy(params: {
  phoneNumberId: string;
  to: string;
  accessToken: string;
  replyToMessageId?: string;
}): Promise<void> {
  await sendTextMessage({
    phoneNumberId: params.phoneNumberId,
    to: params.to,
    text: getClientHandoffMessage(),
    accessToken: params.accessToken,
    ...(params.replyToMessageId ? { replyToMessageId: params.replyToMessageId } : {}),
  });
}

async function executeHandoff(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken: string;
  replyToMessageId?: string;
  reason: "ai" | "webhook";
  lastMessagePreview: string;
}): Promise<void> {
  await performHandoff({
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    reason: params.reason,
  });

  await sendHandoffCourtesy({
    phoneNumberId: params.phoneNumberId,
    to: params.customerPhone,
    accessToken: params.accessToken,
    ...(params.replyToMessageId ? { replyToMessageId: params.replyToMessageId } : {}),
  });

  const updated = await getConversation(
    params.tenantId,
    params.botId,
    params.conversationId
  );

  if (updated) {
    await notifyAdvisorOfConversation({
      tenantId: params.tenantId,
      botId: params.botId,
      conversation: updated,
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      lastMessagePreview: params.lastMessagePreview,
      force: true,
    });
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

  const { tenantId, botId, phoneNumberId, message } = body;
  const contact = normalizeWhatsAppContact(body.contact);
  const contactName = contact.profile.name;

  try {
    const [bot, accessToken] = await Promise.all([
      getBot(tenantId, botId),
      getWhatsAppAccessToken(tenantId, ENVIRONMENT),
    ]);

    if (!bot) {
      console.error(`Bot not found: tenantId=${tenantId} botId=${botId}`);
      return;
    }

    await markMessageAsRead(phoneNumberId, message.id, accessToken).catch(() => {});

    const conversation = await getOrCreateConversation(
      tenantId,
      botId,
      message.from,
      contactName
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
      source: "whatsapp_inbound",
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

    if ((conversation.handoffMode ?? "bot") === "human") {
      await addMessage(userMessage, botId);
      await incrementMessages(tenantId);

      const refreshed = await getConversation(tenantId, botId, conversation.conversationId);
      if (refreshed) {
        await notifyAdvisorOfConversation({
          tenantId,
          botId,
          conversation: refreshed,
          phoneNumberId,
          accessToken,
          lastMessagePreview: userMessageText,
        });
      }

      console.log(
        `Human mode message stored tenant=${tenantId} conversation=${conversation.conversationId}`
      );
      return;
    }

    let aiResponse: string | null = null;
    let shouldHandoff = false;
    let handoffReason: "ai" | "webhook" = "ai";

    if (bot.responseMode === "webhook" && bot.webhookUrl) {
      const webhookResult = await callCustomWebhook(bot.webhookUrl, bot.webhookSecret, {
        message: userMessageText,
        from: message.from,
        conversationId: conversation.conversationId,
        botId,
        contact: { name: contactName },
      });
      if (webhookResult.handoff) {
        shouldHandoff = true;
        handoffReason = "webhook";
      } else {
        aiResponse = webhookResult.reply;
      }
    } else {
      const openAIKey = await getOpenAIApiKey(tenantId, ENVIRONMENT);
      const result = await generateChatResponse(bot, history, userMessageText, openAIKey);
      if (result.handoff) {
        shouldHandoff = true;
      } else {
        aiResponse = result.reply;
      }
    }

    await addMessage(userMessage, botId);

    if (shouldHandoff) {
      await executeHandoff({
        tenantId,
        botId,
        conversationId: conversation.conversationId,
        phoneNumberId,
        customerPhone: message.from,
        accessToken,
        replyToMessageId: message.id,
        reason: handoffReason,
        lastMessagePreview: userMessageText,
      });
      await incrementMessages(tenantId);
      console.log(`Handoff executed tenant=${tenantId} conversation=${conversation.conversationId}`);
      return;
    }

    if (!aiResponse) {
      throw new Error("No AI response generated");
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
