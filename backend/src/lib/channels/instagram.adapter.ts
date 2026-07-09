import { normalizeInstagramMessage } from "../instagram/inbound.js";
import { sendInstagramTextMessage } from "../instagram/client.js";
import type { InstagramInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const instagramAdapter: ChannelAdapter = {
  channel: "instagram",

  normalizeInbound(payload: unknown) {
    const ig = payload as InstagramInboundPayload;
    return normalizeInstagramMessage(ig.message);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    if (!ctx.instagramPageId || !ctx.accessToken) {
      throw new Error("Instagram outbound requires instagramPageId and accessToken");
    }
    const result = await sendInstagramTextMessage({
      pageId: ctx.instagramPageId,
      recipientId: ctx.participantId,
      text,
      accessToken: ctx.accessToken,
    });
    return { externalMessageId: result.messageId };
  },

};

export function isInstagramPayload(payload: unknown): payload is InstagramInboundPayload {
  const p = payload as InstagramInboundPayload;
  return Boolean(p?.pageId && p?.senderId && p?.message);
}
