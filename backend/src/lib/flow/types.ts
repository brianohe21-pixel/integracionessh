import type { Bot, Conversation, FlowDefinition, InboundNormalized, Channel } from "../../types/index.js";

export type FlowExecutionMode = "conversation" | "event";

export function requireConversation(ctx: FlowExecutionContext): Conversation {
  if (!ctx.conversation) {
    throw new Error("Conversation context is required");
  }
  return ctx.conversation;
}

export function requireMessagingContext(ctx: FlowExecutionContext): {
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
} {
  const conversation = requireConversation(ctx);
  if (!ctx.phoneNumberId || !ctx.accessToken || !ctx.customerPhone) {
    throw new Error("Messaging context is required");
  }
  return {
    conversation,
    phoneNumberId: ctx.phoneNumberId,
    accessToken: ctx.accessToken,
    customerPhone: ctx.customerPhone,
  };
}

export interface FlowExecutionContext {
  mode: FlowExecutionMode;
  tenantId: string;
  botId?: string;
  bot?: Bot;
  flow: FlowDefinition;
  environment: string;
  formPayload?: Record<string, unknown>;
  conversation?: Conversation;
  channel?: Channel;
  phoneNumberId?: string;
  accessToken?: string;
  customerPhone?: string;
  replyToMessageId?: string;
  inbound?: InboundNormalized;
  buttonReplyId?: string;
}

export interface NodeExecutionResult {
  nextNodeId: string | null;
  nextHandle?: string;
  halt: boolean;
  wait: boolean;
  waitingUntil?: string;
  externalWait?: boolean;
  variables?: Record<string, string>;
  output?: string;
  error?: string;
}
