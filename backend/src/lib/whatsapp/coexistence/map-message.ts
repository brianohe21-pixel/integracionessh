import type {
  Message,
  MessageRole,
  MessageType,
  WhatsAppHistoryMessage,
  WhatsAppMessageEcho,
} from "../../../types/index.js";

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function resolveParticipantFromHistory(
  businessPhone: string,
  messageFrom: string
): { participantId: string; role: MessageRole } {
  const businessDigits = normalizeDigits(businessPhone);
  const fromDigits = normalizeDigits(messageFrom);
  const isOutbound = fromDigits === businessDigits || messageFrom === businessPhone;
  if (isOutbound) {
    return { participantId: "", role: "advisor" };
  }
  return { participantId: messageFrom, role: "user" };
}

export function mapHistoryMessageToContent(message: WhatsAppHistoryMessage): {
  content: string;
  messageType: MessageType;
} {
  if (message.type === "text" && message.text?.body) {
    return { content: message.text.body, messageType: "text" };
  }
  if (message.type === "media_placeholder") {
    return { content: "[media]", messageType: "text" };
  }
  if (message.type === "image") {
    return {
      content: message.image?.caption ?? "[image]",
      messageType: "image",
    };
  }
  if (message.type === "audio") {
    return { content: "[audio]", messageType: "audio" };
  }
  if (message.type === "video") {
    return {
      content: message.video?.caption ?? "[video]",
      messageType: "video",
    };
  }
  if (message.type === "document") {
    return {
      content: message.document?.caption ?? "[document]",
      messageType: "document",
    };
  }
  return { content: `[${message.type}]`, messageType: "text" };
}

export function buildMessageFromHistory(params: {
  tenantId: string;
  conversationId: string;
  threadParticipantId: string;
  businessPhone: string;
  message: WhatsAppHistoryMessage;
  metadata?: Record<string, unknown>;
}): Message {
  const { role } = resolveParticipantFromHistory(
    params.businessPhone,
    params.message.from
  );
  const resolvedParticipant =
    role === "user" ? params.message.from : params.threadParticipantId;
  const { content, messageType } = mapHistoryMessageToContent(params.message);
  const timestamp = new Date(Number(params.message.timestamp) * 1000).toISOString();

  return {
    messageId: params.message.id,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role,
    content,
    channel: "whatsapp",
    messageType,
    source: "whatsapp_history",
    whatsappMessageId: params.message.id,
    externalMessageId: params.message.id,
    timestamp,
    metadata: {
      coexistence: true,
      history: true,
      participantId: resolvedParticipant,
      historyStatus: params.message.history_context?.status,
      ...params.metadata,
    },
  };
}

export function buildMessageFromEcho(params: {
  tenantId: string;
  conversationId: string;
  echo: WhatsAppMessageEcho;
  metadata?: Record<string, unknown>;
}): Message {
  const { content, messageType } = mapEchoToContent(params.echo);
  const timestamp = new Date(Number(params.echo.timestamp) * 1000).toISOString();

  return {
    messageId: params.echo.id,
    conversationId: params.conversationId,
    tenantId: params.tenantId,
    role: "advisor",
    content,
    channel: "whatsapp",
    messageType,
    source: "whatsapp_app_echo",
    whatsappMessageId: params.echo.id,
    externalMessageId: params.echo.id,
    timestamp,
    metadata: {
      coexistence: true,
      echo: true,
      to: params.echo.to,
      ...params.metadata,
    },
  };
}

function mapEchoToContent(echo: WhatsAppMessageEcho): {
  content: string;
  messageType: MessageType;
} {
  if (echo.type === "text" && echo.text?.body) {
    return { content: echo.text.body, messageType: "text" };
  }
  if (echo.type === "image") {
    return { content: echo.image?.caption ?? "[image]", messageType: "image" };
  }
  if (echo.type === "audio") {
    return { content: "[audio]", messageType: "audio" };
  }
  if (echo.type === "video") {
    return { content: echo.video?.caption ?? "[video]", messageType: "video" };
  }
  if (echo.type === "document") {
    return { content: echo.document?.caption ?? "[document]", messageType: "document" };
  }
  return { content: `[${echo.type}]`, messageType: "text" };
}
