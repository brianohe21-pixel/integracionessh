import { randomUUID } from "crypto";
import { addMessage } from "../dynamodb/conversation.repository.js";
import type { Channel, Message, MessageType } from "../../types/index.js";
import type { FlowExecutionContext } from "./types.js";

const ADAPTER_PERSISTS_ON_SEND: ReadonlySet<Channel> = new Set([
  "webchat",
  "phone",
  "voicebot",
]);

export async function persistFlowOutboundMessage(params: {
  ctx: FlowExecutionContext;
  content: string;
  externalMessageId?: string;
  messageType?: MessageType;
  metadata?: Record<string, unknown>;
  skipIfAdapterPersists?: boolean;
}): Promise<void> {
  const { ctx, content } = params;
  if (!ctx.conversation || !ctx.botId || !content) return;

  const channel = (ctx.conversation.channel ?? ctx.channel ?? "whatsapp") as Channel;
  if (params.skipIfAdapterPersists !== false && ADAPTER_PERSISTS_ON_SEND.has(channel)) {
    return;
  }

  const externalMessageId = params.externalMessageId;
  const timestamp = new Date().toISOString();
  const message: Message = {
    messageId: externalMessageId ?? `flow-${randomUUID()}`,
    conversationId: ctx.conversation.conversationId,
    tenantId: ctx.tenantId,
    role: "assistant",
    content,
    channel,
    timestamp,
    ...(params.messageType ? { messageType: params.messageType } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...(externalMessageId
      ? {
          externalMessageId,
          ...(channel === "whatsapp" ? { whatsappMessageId: externalMessageId } : {}),
        }
      : {}),
  };

  await addMessage(message, ctx.botId);
}
