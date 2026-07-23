import type { InboundNormalized, SmsInboundPayload } from "../../types/index.js";

export function isProcessableSmsMessage(payload: SmsInboundPayload): boolean {
  return Boolean(payload.messageBody?.trim());
}

export function normalizeSmsMessage(payload: SmsInboundPayload): InboundNormalized {
  return {
    text: payload.messageBody,
    messageType: "text",
    raw: payload,
  };
}

export interface SnsSmsInboundEvent {
  originationNumber: string;
  destinationNumber: string;
  messageKeyword?: string;
  messageBody: string;
  inboundMessageId: string;
}

export function parseSnsSmsBody(message: string): SnsSmsInboundEvent | null {
  try {
    const parsed = JSON.parse(message) as SnsSmsInboundEvent;
    if (!parsed.originationNumber || !parsed.destinationNumber || !parsed.messageBody) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
