import type {
  Channel,
  InboundQueueMessage,
  SQSMessageBody,
} from "../../types/index.js";
import { isInstagramPayload } from "../channels/instagram.adapter.js";
import { isWebChatPayload } from "../channels/webchat.adapter.js";
import { isWhatsAppPayload } from "../channels/whatsapp.adapter.js";

export function parseInboundQueueBody(raw: string): InboundQueueMessage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.channel && parsed.tenantId && parsed.botId && parsed.participantId) {
      return parsed as unknown as InboundQueueMessage;
    }
    return legacyWhatsAppBodyToInbound(parsed as unknown as SQSMessageBody);
  } catch {
    return null;
  }
}

function legacyWhatsAppBodyToInbound(body: SQSMessageBody): InboundQueueMessage | null {
  if (!body.tenantId || !body.botId || !body.message?.from) return null;
  const contactName = body.contact?.profile?.name;
  return {
    channel: "whatsapp",
    tenantId: body.tenantId,
    botId: body.botId,
    participantId: body.message.from,
    conversationKey: body.conversationId ?? `${body.tenantId}-${body.botId}-${body.message.from}`,
    ...(contactName ? { displayName: contactName } : {}),
    replyToExternalId: body.message.id,
    payload: {
      phoneNumberId: body.phoneNumberId,
      message: body.message,
      contact: body.contact ?? { wa_id: body.message.from },
    },
  };
}

export function externalMessageIdFromBody(body: InboundQueueMessage): string {
  if (body.channel === "whatsapp") {
    const p = body.payload as import("../../types/index.js").WhatsAppInboundPayload;
    return p.message.id;
  }
  if (body.channel === "instagram") {
    const p = body.payload as import("../../types/index.js").InstagramInboundPayload;
    return p.message.mid;
  }
  const p = body.payload as import("../../types/index.js").WebChatInboundPayload;
  return p.messageId;
}

export function assertPayloadMatchesChannel(body: InboundQueueMessage): void {
  if (body.channel === "whatsapp" && !isWhatsAppPayload(body.payload)) {
    throw new Error("Invalid WhatsApp payload");
  }
  if (body.channel === "instagram" && !isInstagramPayload(body.payload)) {
    throw new Error("Invalid Instagram payload");
  }
  if (body.channel === "webchat" && !isWebChatPayload(body.payload)) {
    throw new Error("Invalid WebChat payload");
  }
}

export function channelLabel(channel: Channel): string {
  if (channel === "instagram") return "Instagram";
  if (channel === "webchat") return "Web chat";
  return "WhatsApp";
}
