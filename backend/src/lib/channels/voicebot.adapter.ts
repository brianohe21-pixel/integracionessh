import { randomUUID } from "crypto";
import { addMessage } from "../dynamodb/conversation.repository.js";
import type { Message } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const voicebotAdapter: ChannelAdapter = {
  channel: "voicebot",

  normalizeInbound() {
    return {
      text: "",
      messageType: "text" as const,
      raw: {},
    };
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    const messageId = `vb-out-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    const message: Message = {
      messageId,
      conversationId: ctx.conversation.conversationId,
      tenantId: ctx.tenantId,
      role: "advisor",
      content: text,
      channel: "voicebot",
      source: "panel",
      externalMessageId: messageId,
      timestamp,
    };
    await addMessage(message, ctx.botId);
    return { externalMessageId: messageId };
  },
};
