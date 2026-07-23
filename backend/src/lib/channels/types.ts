import type {
  Bot,
  Channel,
  Conversation,
  InboundNormalized,
  MessageSource,
} from "../../types/index.js";

export interface OutboundContext {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  channel: Channel;
  participantId: string;
  phoneNumberId?: string;
  instagramPageId?: string;
  messengerPageId?: string;
  telegramChatId?: string;
  smsOriginationNumber?: string;
  emailAddress?: string;
  emailSubject?: string;
  emailThreadMessageId?: string;
  accessToken?: string;
  replyToExternalId?: string;
  environment: string;
}

export interface OutboundResult {
  externalMessageId?: string;
}

export interface ChannelAdapter {
  channel: Channel;
  normalizeInbound(payload: unknown): InboundNormalized;
  sendText(ctx: OutboundContext, text: string): Promise<OutboundResult>;
  markRead?(ctx: OutboundContext, externalMessageId: string): Promise<void>;
}

export function inboundSourceForChannel(
  channel: Channel
): MessageSource {
  if (channel === "instagram") return "instagram_inbound";
  if (channel === "webchat") return "webchat_inbound";
  if (channel === "telegram") return "telegram_inbound";
  if (channel === "messenger") return "messenger_inbound";
  if (channel === "sms") return "sms_inbound";
  if (channel === "email") return "email_inbound";
  return "whatsapp_inbound";
}
