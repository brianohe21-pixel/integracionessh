import type {
  Bot,
  Channel,
  Conversation,
  InboundNormalized,
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

export function inboundSourceForChannel(channel: Channel): "whatsapp_inbound" | "instagram_inbound" | "webchat_inbound" {
  if (channel === "instagram") return "instagram_inbound";
  if (channel === "webchat") return "webchat_inbound";
  return "whatsapp_inbound";
}
