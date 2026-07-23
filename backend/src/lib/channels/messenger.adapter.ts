import { normalizeMessengerMessage } from "../messenger/inbound.js";
import { sendMessengerTextMessage } from "../messenger/client.js";
import type { MessengerInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const messengerAdapter: ChannelAdapter = {
  channel: "messenger",

  normalizeInbound(payload: unknown) {
    return normalizeMessengerMessage(payload as MessengerInboundPayload);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    if (!ctx.messengerPageId || !ctx.accessToken) {
      throw new Error("Messenger outbound requires messengerPageId and accessToken");
    }
    const result = await sendMessengerTextMessage({
      pageId: ctx.messengerPageId,
      recipientId: ctx.participantId,
      text,
      accessToken: ctx.accessToken,
    });
    return { externalMessageId: result.messageId };
  },
};

export function isMessengerPayload(payload: unknown): payload is MessengerInboundPayload {
  const p = payload as MessengerInboundPayload;
  return Boolean(p?.pageId && p?.senderId && p?.message);
}
