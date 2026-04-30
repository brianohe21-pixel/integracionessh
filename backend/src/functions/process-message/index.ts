import type { SQSEvent, SQSRecord } from "aws-lambda";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
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
} from "../../lib/whatsapp/client.js";
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

  const { tenantId, botId, conversationId, phoneNumberId, message, contact } = body;

  try {
    const [bot, accessToken, openAIKey] = await Promise.all([
      getBot(tenantId, botId),
      getWhatsAppAccessToken(tenantId, ENVIRONMENT),
      getOpenAIApiKey(tenantId, ENVIRONMENT),
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

    const aiResponse = await generateChatResponse(bot, history, userMessageText, openAIKey);

    const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const aiTimestamp = new Date().toISOString();

    const assistantMessage: Message = {
      messageId: aiMessageId,
      conversationId: conversation.conversationId,
      tenantId,
      role: "assistant",
      content: aiResponse,
      timestamp: aiTimestamp,
    };

    await addMessage(userMessage);
    await addMessage(assistantMessage);

    await sendTextMessage({
      phoneNumberId,
      to: message.from,
      text: aiResponse,
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
