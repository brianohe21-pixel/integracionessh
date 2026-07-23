import type {
  Channel,
  InboundQueueMessage,
  SQSMessageBody,
} from "../../types/index.js";
import { isEmailPayload } from "../channels/email.adapter.js";
import { isInstagramPayload } from "../channels/instagram.adapter.js";
import { isMessengerPayload } from "../channels/messenger.adapter.js";
import { isSmsPayload } from "../channels/sms.adapter.js";
import { isTelegramPayload } from "../channels/telegram.adapter.js";
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
  if (body.channel === "messenger") {
    const p = body.payload as import("../../types/index.js").MessengerInboundPayload;
    return p.message.mid;
  }
  if (body.channel === "telegram") {
    const p = body.payload as import("../../types/index.js").TelegramInboundPayload;
    return String(p.messageId);
  }
  if (body.channel === "sms") {
    const p = body.payload as import("../../types/index.js").SmsInboundPayload;
    return p.inboundMessageId;
  }
  if (body.channel === "email") {
    const p = body.payload as import("../../types/index.js").EmailInboundPayload;
    return p.messageId;
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
  if (body.channel === "telegram" && !isTelegramPayload(body.payload)) {
    throw new Error("Invalid Telegram payload");
  }
  if (body.channel === "messenger" && !isMessengerPayload(body.payload)) {
    throw new Error("Invalid Messenger payload");
  }
  if (body.channel === "sms" && !isSmsPayload(body.payload)) {
    throw new Error("Invalid SMS payload");
  }
  if (body.channel === "email" && !isEmailPayload(body.payload)) {
    throw new Error("Invalid Email payload");
  }
}

export function channelLabel(channel: Channel): string {
  if (channel === "instagram") return "Instagram";
  if (channel === "webchat") return "Web chat";
  if (channel === "telegram") return "Telegram";
  if (channel === "messenger") return "Messenger";
  if (channel === "sms") return "SMS";
  if (channel === "email") return "Email";
  return "WhatsApp";
}
