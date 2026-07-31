import { normalizeTelegramMessage } from "../telegram/inbound.js";
import { sendTelegramTextMessage } from "../telegram/client.js";
import type { TelegramInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const telegramAdapter: ChannelAdapter = {
  channel: "telegram",

  normalizeInbound(payload: unknown) {
    return normalizeTelegramMessage(payload as TelegramInboundPayload);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    if (!ctx.accessToken) {
      throw new Error("Telegram outbound requires bot token");
    }
    const chatId = ctx.telegramChatId ?? ctx.participantId;
    const result = await sendTelegramTextMessage({
      botToken: ctx.accessToken,
      chatId,
      text,
    });
    return { externalMessageId: result.messageId };
  },
};

export function isTelegramPayload(payload: unknown): payload is TelegramInboundPayload {
  const p = payload as TelegramInboundPayload;
  return Boolean(p?.chatId && p?.messageId && typeof p?.text === "string");
}
