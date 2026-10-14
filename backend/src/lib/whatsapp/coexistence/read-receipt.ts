import type { Bot, WhatsAppChannel } from "../../../types/index.js";
import {
  getWhatsAppChannel,
  getWhatsAppChannelByPhoneNumberId,
} from "../../dynamodb/whatsapp-channel.repository.js";

type CoexistenceSource = {
  isOnBizApp?: boolean | undefined;
  whatsappOnboardingMode?: "cloud_api" | "coexistence" | undefined;
};

export function isWhatsAppCoexistence(source: CoexistenceSource | null | undefined): boolean {
  if (!source) return false;
  return source.isOnBizApp === true || source.whatsappOnboardingMode === "coexistence";
}

export async function inboundShouldSkipReadReceipt(params: {
  tenantId: string;
  botId: string;
  bot: Pick<Bot, "isOnBizApp" | "whatsappOnboardingMode" | "phoneNumberId">;
  phoneNumberId?: string | undefined;
  channelId?: string | undefined;
}): Promise<boolean> {
  try {
    const channel = await resolveInboundChannel(params);
    if (channel) return isWhatsAppCoexistence(channel);
  } catch (err) {
    console.warn("Failed to resolve WhatsApp channel for read receipt:", err);
  }
  return isWhatsAppCoexistence(params.bot);
}

async function resolveInboundChannel(params: {
  tenantId: string;
  botId: string;
  bot: Pick<Bot, "phoneNumberId">;
  phoneNumberId?: string | undefined;
  channelId?: string | undefined;
}): Promise<WhatsAppChannel | null> {
  if (params.channelId) {
    const channel = await getWhatsAppChannel(params.tenantId, params.botId, params.channelId);
    if (channel) return channel;
  }

  const phoneNumberId = params.phoneNumberId?.trim();
  if (!phoneNumberId || phoneNumberId === params.bot.phoneNumberId) return null;
  return getWhatsAppChannelByPhoneNumberId(phoneNumberId);
}
