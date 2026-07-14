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
  channel?: string;
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
      channel: params.channel ?? "whatsapp",
      from: params.from,
      message: params.message,
      contact: { name: params.contactName ?? "" },
    },
  });
}

export function buildMessageSentPayload(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  channel?: string;
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
      channel: params.channel ?? "whatsapp",
      to: params.to,
      message: params.message,
      role: params.role,
    },
  });
}

export function buildFlowCompletedPayload(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  phone: string;
  metaFlowId: string;
  responseJson: Record<string, unknown>;
  channel?: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "flow.completed",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      conversationId: params.conversationId,
      channel: params.channel ?? "whatsapp",
      phone: params.phone,
      metaFlowId: params.metaFlowId,
      response: params.responseJson,
    },
  });
}

export function buildLeadCreatedPayload(params: {
  tenantId: string;
  botId: string;
  leadId: string;
  conversationId: string;
  phone: string;
  metaFlowId: string;
  name?: string;
  email?: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "lead.created",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      leadId: params.leadId,
      conversationId: params.conversationId,
      phone: params.phone,
      metaFlowId: params.metaFlowId,
      ...(params.name ? { name: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
    },
  });
}

export function buildLeadConvertedPayload(params: {
  tenantId: string;
  botId: string;
  leadId: string;
  conversationId: string;
  phone: string;
  contact: { phoneNumber: string; displayName?: string; email?: string; tags: string[] };
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "lead.converted",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      leadId: params.leadId,
      conversationId: params.conversationId,
      phone: params.phone,
      contact: {
        phone: params.contact.phoneNumber,
        name: params.contact.displayName ?? "",
        email: params.contact.email ?? "",
        tags: params.contact.tags,
      },
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

export function buildCallConnectPayload(params: {
  tenantId: string;
  botId: string;
  callId: string;
  direction: string;
  from: string;
  to: string;
  session?: { sdp_type: string; sdp: string };
  bizOpaqueCallbackData?: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "call.connect",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      callId: params.callId,
      direction: params.direction,
      from: params.from,
      to: params.to,
      ...(params.session ? { session: params.session } : {}),
      ...(params.bizOpaqueCallbackData
        ? { bizOpaqueCallbackData: params.bizOpaqueCallbackData }
        : {}),
    },
  });
}

export function buildCallStatusPayload(params: {
  tenantId: string;
  botId: string;
  callId: string;
  status: string;
  phoneNumber: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "call.status",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      callId: params.callId,
      status: params.status,
      phoneNumber: params.phoneNumber,
    },
  });
}

export function buildCallTerminatedPayload(params: {
  tenantId: string;
  botId: string;
  callId: string;
  direction: string;
  phoneNumber: string;
  duration?: number;
  status: string;
  bizOpaqueCallbackData?: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "call.terminated",
    tenantId: params.tenantId,
    data: {
      botId: params.botId,
      callId: params.callId,
      direction: params.direction,
      phoneNumber: params.phoneNumber,
      status: params.status,
      ...(params.duration !== undefined ? { duration: params.duration } : {}),
      ...(params.bizOpaqueCallbackData
        ? { bizOpaqueCallbackData: params.bizOpaqueCallbackData }
        : {}),
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

export function buildOrderCreatedPayload(params: {
  tenantId: string;
  botId: string;
  order: import("../../types/index.js").CatalogOrder;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "order.created",
    tenantId: params.tenantId,
    data: {
      orderId: params.order.orderId,
      botId: params.botId,
      contactPhone: params.order.contactPhone,
      status: params.order.status,
      subtotalInCents: params.order.subtotalInCents,
      currency: params.order.currency,
      items: params.order.items,
      source: params.order.source,
      ...(params.order.paymentId ? { paymentId: params.order.paymentId } : {}),
    },
  });
}

export function buildOrderStatusChangedPayload(params: {
  tenantId: string;
  botId: string;
  order: import("../../types/index.js").CatalogOrder;
  previousStatus: string;
}): IntegrationEventPayload {
  return buildIntegrationPayload({
    event: "order.status_changed",
    tenantId: params.tenantId,
    data: {
      orderId: params.order.orderId,
      botId: params.botId,
      contactPhone: params.order.contactPhone,
      status: params.order.status,
      previousStatus: params.previousStatus,
      subtotalInCents: params.order.subtotalInCents,
      currency: params.order.currency,
    },
  });
}
