import type { Channel } from "../../types/index.js";
import { emailAdapter } from "./email.adapter.js";
import { instagramAdapter } from "./instagram.adapter.js";
import { messengerAdapter } from "./messenger.adapter.js";
import { phoneAdapter } from "./phone.adapter.js";
import { smsAdapter } from "./sms.adapter.js";
import { telegramAdapter } from "./telegram.adapter.js";
import type {
  ChannelAdapter,
  OutboundAudio,
  OutboundContext,
  OutboundDocument,
  OutboundImage,
  OutboundResult,
} from "./types.js";
import { webchatAdapter } from "./webchat.adapter.js";
import { voicebotAdapter } from "./voicebot.adapter.js";
import { whatsappAdapter } from "./whatsapp.adapter.js";
import { phoneNumberIdForOutbound } from "../whatsapp/channel-context.js";

const adapters: Record<Channel, ChannelAdapter> = {
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
  webchat: webchatAdapter,
  telegram: telegramAdapter,
  messenger: messengerAdapter,
  sms: smsAdapter,
  email: emailAdapter,
  voicebot: voicebotAdapter,
  phone: phoneAdapter,
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

export async function sendChannelDocument(
  ctx: OutboundContext,
  doc: OutboundDocument
): Promise<OutboundResult> {
  const adapter = getChannelAdapter(ctx.channel);
  if (!adapter.sendDocument) {
    throw new Error(`Channel ${ctx.channel} does not support document messages`);
  }
  return adapter.sendDocument(ctx, doc);
}

export async function sendChannelImage(
  ctx: OutboundContext,
  image: OutboundImage
): Promise<OutboundResult> {
  const adapter = getChannelAdapter(ctx.channel);
  if (!adapter.sendImage) {
    throw new Error(`Channel ${ctx.channel} does not support image messages`);
  }
  return adapter.sendImage(ctx, image);
}

export async function sendChannelAudio(
  ctx: OutboundContext,
  audio: OutboundAudio
): Promise<OutboundResult> {
  const adapter = getChannelAdapter(ctx.channel);
  if (!adapter.sendAudio) {
    throw new Error(`Channel ${ctx.channel} does not support audio messages`);
  }
  return adapter.sendAudio(ctx, audio);
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
  phoneNumberId?: string | undefined;
}): OutboundContext {
  const channel = params.conversation.channel ?? "whatsapp";
  const participantId =
    params.conversation.participantId ?? params.conversation.phoneNumber;

  const resolvedPhoneNumberId =
    params.phoneNumberId ??
    phoneNumberIdForOutbound(params.conversation, params.bot);

  return {
    tenantId: params.tenantId,
    botId: params.botId,
    bot: params.bot,
    conversation: params.conversation,
    channel,
    participantId,
    phoneNumberId: resolvedPhoneNumberId,
    ...(params.bot.instagramPageId ? { instagramPageId: params.bot.instagramPageId } : {}),
    ...(params.bot.messengerPageId ? { messengerPageId: params.bot.messengerPageId } : {}),
    ...(channel === "telegram" ? { telegramChatId: participantId } : {}),
    ...(params.bot.smsOriginationNumber
      ? { smsOriginationNumber: params.bot.smsOriginationNumber }
      : {}),
    ...(params.bot.emailAddress ? { emailAddress: params.bot.emailAddress } : {}),
    ...(params.conversation.emailSubject
      ? { emailSubject: params.conversation.emailSubject }
      : {}),
    ...(params.conversation.emailThreadMessageId
      ? { emailThreadMessageId: params.conversation.emailThreadMessageId }
      : {}),
    ...(params.accessToken ? { accessToken: params.accessToken } : {}),
    ...(params.replyToExternalId ? { replyToExternalId: params.replyToExternalId } : {}),
    environment: params.environment,
  };
}
