import type { Bot, Conversation, FlowDefinition, InboundNormalized, Channel } from "../../types/index.js";

export interface FlowExecutionContext {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  channel: Channel;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
  replyToMessageId?: string;
  inbound: InboundNormalized;
  flow: FlowDefinition;
  buttonReplyId?: string;
  environment: string;
}

export interface NodeExecutionResult {
  nextNodeId: string | null;
  nextHandle?: string;
  halt: boolean;
  wait: boolean;
  waitingUntil?: string;
  variables?: Record<string, string>;
  output?: string;
}
