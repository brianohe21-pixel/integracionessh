import type { Channel } from "../../types/index.js";
import { instagramAdapter } from "./instagram.adapter.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";
import { webchatAdapter } from "./webchat.adapter.js";
import { whatsappAdapter } from "./whatsapp.adapter.js";

const adapters: Record<Channel, ChannelAdapter> = {
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  webchat: webchatAdapter,
};

export function getChannelAdapter(channel: Channel): ChannelAdapter {
  const adapter = adapters[channel];
  if (!adapter) throw new Error(`Unsupported channel: ${channel}`);
  return adapter;
}

export async function sendChannelText(
  ctx: OutboundContext,
  text: string
): Promise<OutboundResult> {
  return getChannelAdapter(ctx.channel).sendText(ctx, text);
}

export async function markChannelRead(
  ctx: OutboundContext,
  externalMessageId: string
): Promise<void> {
  const adapter = getChannelAdapter(ctx.channel);
  if (adapter.markRead) {
    await adapter.markRead(ctx, externalMessageId);
  }
}

export function buildOutboundContext(params: {
  tenantId: string;
  botId: string;
  bot: import("../../types/index.js").Bot;
  conversation: import("../../types/index.js").Conversation;
  accessToken?: string | undefined;
  environment: string;
  replyToExternalId?: string | undefined;
}): OutboundContext {
  const channel = params.conversation.channel ?? "whatsapp";
  const participantId =
    params.conversation.participantId ?? params.conversation.phoneNumber;

  return {
    tenantId: params.tenantId,
    botId: params.botId,
    bot: params.bot,
    conversation: params.conversation,
    channel,
    participantId,
    phoneNumberId: params.bot.phoneNumberId,
    ...(params.bot.instagramPageId ? { instagramPageId: params.bot.instagramPageId } : {}),
    ...(params.accessToken ? { accessToken: params.accessToken } : {}),
    ...(params.replyToExternalId ? { replyToExternalId: params.replyToExternalId } : {}),
    environment: params.environment,
  };
}
