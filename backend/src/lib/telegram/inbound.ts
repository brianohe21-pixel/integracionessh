import type { InboundNormalized, TelegramInboundPayload } from "../../types/index.js";

export function isProcessableTelegramMessage(payload: TelegramInboundPayload): boolean {
  return Boolean(payload.text?.trim());
}

export function normalizeTelegramMessage(payload: TelegramInboundPayload): InboundNormalized {
  return {
    text: payload.text,
    messageType: "text",
    raw: payload,
  };
}
