import type { InboundNormalized, MessageType, WhatsAppMessage } from "../../types/index.js";

function formatFlowResponseJson(responseJson: string): string {
  try {
    const parsed = JSON.parse(responseJson) as Record<string, unknown>;
    const parts = Object.entries(parsed).map(([k, v]) => `${k}: ${String(v)}`);
    return parts.length ? parts.join(", ") : responseJson;
  } catch {
    return responseJson;
  }
}

export function isProcessableInboundMessage(message: WhatsAppMessage): boolean {
  if (message.type === "text" && message.text?.body) return true;
  if (message.type === "interactive" && message.interactive) {
    const t = message.interactive.type;
    return t === "button_reply" || t === "list_reply" || t === "nfm_reply";
  }
  return false;
}

export function normalizeInboundMessage(message: WhatsAppMessage): InboundNormalized {
  if (message.type === "text" && message.text?.body) {
    return {
      text: message.text.body,
      messageType: "text",
      raw: message,
    };
  }

  const interactive = message.interactive;
  if (!interactive) {
    return { text: "", messageType: "text", raw: message };
  }

  if (interactive.type === "button_reply" && interactive.button_reply) {
    return {
      text: interactive.button_reply.title,
      messageType: "interactive",
      interactive: {
        kind: "button",
        id: interactive.button_reply.id,
        payload: interactive.button_reply.id,
      },
      raw: message,
    };
  }

  if (interactive.type === "list_reply" && interactive.list_reply) {
    return {
      text: interactive.list_reply.title,
      messageType: "interactive",
      interactive: {
        kind: "list",
        id: interactive.list_reply.id,
        payload: interactive.list_reply.id,
      },
      raw: message,
    };
  }

  if (interactive.type === "nfm_reply" && interactive.nfm_reply) {
    const responseJson = interactive.nfm_reply.response_json;
    return {
      text: formatFlowResponseJson(responseJson),
      messageType: "flow_response",
      interactive: {
        kind: "nfm",
        responseJson,
      },
      raw: message,
    };
  }

  return { text: "", messageType: "interactive", raw: message };
}

export function inboundMessageTypeToMessageType(type: MessageType): MessageType {
  return type;
}
