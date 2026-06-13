import { randomUUID } from "crypto";
import { addMessage } from "../dynamodb/conversation.repository.js";
import type { Message, WebChatInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const webchatAdapter: ChannelAdapter = {
  channel: "webchat",

  normalizeInbound(payload: unknown) {
    const wc = payload as WebChatInboundPayload;
    return {
      text: wc.text,
      messageType: "text" as const,
      raw: wc,
    };
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    const messageId = `wc-out-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const message: Message = {
      messageId,
      conversationId: ctx.conversation.conversationId,
      tenantId: ctx.tenantId,
      role: "assistant",
      content: text,
      channel: "webchat",
      source: "panel",
      externalMessageId: messageId,
      timestamp,
    };
    await addMessage(message, ctx.botId);
    return { externalMessageId: messageId };
  },

};

export function isWebChatPayload(payload: unknown): payload is WebChatInboundPayload {
  const p = payload as WebChatInboundPayload;
  return Boolean(p?.sessionId && p?.messageId && typeof p.text === "string");
}
