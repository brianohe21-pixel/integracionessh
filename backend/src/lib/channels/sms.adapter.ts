import { normalizeSmsMessage } from "../sms/inbound.js";
import { sendSmsTextMessage } from "../sms/client.js";
import type { SmsInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const smsAdapter: ChannelAdapter = {
  channel: "sms",

  normalizeInbound(payload: unknown) {
    return normalizeSmsMessage(payload as SmsInboundPayload);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    const result = await sendSmsTextMessage({
      phoneNumber: ctx.participantId,
      text,
      ...(ctx.smsOriginationNumber ? { originationNumber: ctx.smsOriginationNumber } : {}),
    });
    return { externalMessageId: result.messageId };
  },
};

export function isSmsPayload(payload: unknown): payload is SmsInboundPayload {
  const p = payload as SmsInboundPayload;
  return Boolean(
    p?.originationNumber && p?.destinationNumber && p?.messageBody && p?.inboundMessageId
  );
}
