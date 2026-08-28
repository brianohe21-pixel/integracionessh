import type { Bot, Conversation, WhatsAppChannel } from "../../types/index.js";
import { getBot } from "../dynamodb/bot.repository.js";
import {
  getDefaultWhatsAppChannel,
  getWhatsAppChannel,
  getWhatsAppChannelByPhoneNumberId,
} from "../dynamodb/whatsapp-channel.repository.js";
import {
  getWhatsAppAccessTokenForAccount,
  getWhatsAppAccessToken,
} from "./secrets.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export interface ResolvedWhatsAppChannel {
  channel: WhatsAppChannel;
  bot: Bot;
  accessToken: string;
}

export async function resolveWhatsAppChannelByPhoneNumberId(
  phoneNumberId: string
): Promise<ResolvedWhatsAppChannel | null> {
  const channel = await getWhatsAppChannelByPhoneNumberId(phoneNumberId);
  if (!channel || channel.status !== "active") return null;

  const bot = await getBot(channel.tenantId, channel.botId);
  if (!bot || bot.status !== "active") return null;

  const accessToken = await getWhatsAppAccessTokenForAccount(
    channel.tenantId,
    channel.accountId,
    ENVIRONMENT
  );

  return { channel, bot, accessToken };
}

export async function resolveWhatsAppChannelForConversation(
  conversation: Conversation,
  bot: Bot
): Promise<ResolvedWhatsAppChannel | null> {
  if (conversation.whatsappChannelId) {
    const channel = await getWhatsAppChannel(
      conversation.tenantId,
      conversation.botId,
      conversation.whatsappChannelId
    );
    if (!channel || channel.status !== "active") return null;
    const accessToken = await getWhatsAppAccessTokenForAccount(
      conversation.tenantId,
      channel.accountId,
      ENVIRONMENT
    );
    return { channel, bot, accessToken };
  }

  if (conversation.businessPhoneNumberId) {
    return resolveWhatsAppChannelByPhoneNumberId(conversation.businessPhoneNumberId);
  }

  const defaultChannel = await getDefaultWhatsAppChannel(conversation.tenantId, conversation.botId);
  if (defaultChannel) {
    const accessToken = await getWhatsAppAccessTokenForAccount(
      conversation.tenantId,
      defaultChannel.accountId,
      ENVIRONMENT
    );
    return { channel: defaultChannel, bot, accessToken };
  }

  if (bot.phoneNumberId?.trim()) {
    const accessToken = await getWhatsAppAccessToken(conversation.tenantId, ENVIRONMENT);
    return {
      channel: {
        channelId: "legacy",
        tenantId: conversation.tenantId,
        botId: conversation.botId,
        accountId: "legacy",
        phoneNumberId: bot.phoneNumberId,
        whatsappBusinessAccountId: bot.whatsappBusinessAccountId,
        status: "active",
        isDefault: true,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      },
      bot,
      accessToken,
    };
  }

  return null;
}

export function phoneNumberIdForOutbound(
  conversation: Conversation,
  bot: Bot,
  channel?: WhatsAppChannel | null
): string {
  if (channel?.phoneNumberId) return channel.phoneNumberId;
  if (conversation.businessPhoneNumberId) return conversation.businessPhoneNumberId;
  return bot.phoneNumberId;
}
