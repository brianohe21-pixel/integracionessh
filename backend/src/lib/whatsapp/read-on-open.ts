import type { Bot, Conversation, Message } from "../../types/index.js";
import { buildOutboundContext, markChannelRead } from "../channels/router.js";
import { getConversationMessages } from "../dynamodb/conversation.repository.js";
import { resolveWhatsAppChannelForConversation } from "./channel-context.js";
import { inboundShouldSkipReadReceipt } from "./coexistence/read-receipt.js";

export function latestInboundWhatsAppMessageId(messages: Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "user") continue;
    if ((message.channel ?? "whatsapp") !== "whatsapp") continue;
    const externalId = message.whatsappMessageId || message.externalMessageId;
    if (externalId) return externalId;
  }
  return null;
}

export async function markOpenedWhatsAppConversationRead(params: {
  tenantId: string;
  bot: Bot;
  conversation: Conversation;
  environment: string;
}): Promise<void> {
  if ((params.conversation.channel ?? "whatsapp") !== "whatsapp") return;

  const skip = await inboundShouldSkipReadReceipt({
    tenantId: params.tenantId,
    botId: params.bot.botId,
    bot: params.bot,
    phoneNumberId: params.conversation.businessPhoneNumberId,
    channelId: params.conversation.whatsappChannelId,
  });
  if (skip) return;

  const messages = await getConversationMessages(
    params.tenantId,
    params.conversation.conversationId,
    30
  );
  const externalMessageId = latestInboundWhatsAppMessageId(messages);
  if (!externalMessageId) return;

  const resolved = await resolveWhatsAppChannelForConversation(params.conversation, params.bot);
  const accessToken = resolved?.accessToken;
  if (!accessToken) return;

  await markChannelRead(
    buildOutboundContext({
      tenantId: params.tenantId,
      botId: params.bot.botId,
      bot: params.bot,
      conversation: params.conversation,
      accessToken,
      environment: params.environment,
      ...(resolved?.channel.phoneNumberId
        ? { phoneNumberId: resolved.channel.phoneNumberId }
        : {}),
    }),
    externalMessageId
  );
}
