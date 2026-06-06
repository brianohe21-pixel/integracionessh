import type { IntegrationEvent, IntegrationEventPayload } from "../../types/index.js";

export function buildIntegrationPayload(params: {
  event: IntegrationEvent;
  tenantId: string;
  data: Record<string, unknown>;
}): IntegrationEventPayload {
  return {
    event: params.event,
    timestamp: new Date().toISOString(),
    tenantId: params.tenantId,
    data: params.data,
  };
}

export function buildMessageReceivedPayload(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  from: string;
  message: string;
  contactName?: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "message.received",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      conversationId: params.conversationId,
      from: params.from,
      message: params.message,
      contact: { name: params.contactName ?? "" },
    },
  });
}

export function buildConversationHandoffPayload(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  phoneNumber: string;
  reason: string;
  advisorId?: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "conversation.handoff",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      conversationId: params.conversationId,
      phoneNumber: params.phoneNumber,
      reason: params.reason,
      ...(params.advisorId ? { advisorId: params.advisorId } : {}),
    },
  });
}

export function buildMessageSentPayload(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  to: string;
  message: string;
  role: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "message.sent",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      conversationId: params.conversationId,
      to: params.to,
      message: params.message,
      role: params.role,
    },
  });
}

export function buildTestPayload(tenantId: string): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "message.received",
    tenantId,
    data: {
      botId: "test-bot-id",
      conversationId: "test-conversation-id",
      from: "573000000000",
      message: "Test event from Integraciones SSH",
      contact: { name: "Test" },
    },
  });
}
