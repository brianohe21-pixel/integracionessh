import {
  getConversation,
  updateConversation,
} from "../dynamodb/conversation.repository.js";
import { normalizePhone } from "../dynamodb/contact.repository.js";
import { resolveContactId } from "./resolve-contact-id.js";
import { indexContactConversation } from "./contact-conversation-index.js";
import { updateWebChatSessionIdentity } from "../webchat/session.repository.js";
import { updateVoicebotSessionIdentity } from "../voicebot/session.repository.js";
import type { Conversation } from "../../types/index.js";

export interface LinkConversationToContactParams {
  tenantId: string;
  botId: string;
  conversationId: string;
  phone?: string;
  email?: string;
  displayName?: string;
}

function parseWebchatSessionId(participantId: string): string | null {
  if (!participantId || participantId.includes("@")) return null;
  return participantId;
}

function parseVoicebotSessionId(participantId: string): string | null {
  if (!participantId.startsWith("visitor-")) return null;
  return participantId.slice("visitor-".length) || null;
}

export async function linkConversationToContact(
  params: LinkConversationToContactParams
): Promise<Conversation | null> {
  const conversation = await getConversation(
    params.tenantId,
    params.botId,
    params.conversationId
  );
  if (!conversation) return null;

  const normalizedPhone = params.phone ? normalizePhone(params.phone) : "";
  const phone = normalizedPhone.length >= 10 ? normalizedPhone : undefined;
  const email = params.email?.trim().toLowerCase() || undefined;

  if (!phone && !email && !params.displayName) return conversation;

  const channel = conversation.channel ?? "whatsapp";
  const participantId = conversation.participantId ?? conversation.phoneNumber;

  const updates: Parameters<typeof updateConversation>[3] = {};

  if (phone) {
    updates.phoneNumber = phone;
  }
  if (params.displayName) {
    updates.contactName = params.displayName;
  }

  const contactId = await resolveContactId({
    tenantId: params.tenantId,
    channel,
    participantId,
    ...(phone ? { phoneNumber: phone } : conversation.phoneNumber ? { phoneNumber: conversation.phoneNumber } : {}),
    ...(email ? { email } : channel === "email" ? { email: participantId } : {}),
  });
  updates.contactId = contactId;

  const updated = await updateConversation(
    params.tenantId,
    params.botId,
    params.conversationId,
    updates
  );
  const result: Conversation = {
    ...conversation,
    ...(updated ?? {}),
    contactId,
    ...(phone ? { phoneNumber: phone } : {}),
    ...(params.displayName ? { contactName: params.displayName } : {}),
  };

  await indexContactConversation({
    tenantId: params.tenantId,
    contactId,
    botId: params.botId,
    conversationId: params.conversationId,
    channel,
    lastMessageAt: result.lastMessageAt,
  });

  if (channel === "webchat") {
    const sessionId = parseWebchatSessionId(participantId);
    if (sessionId) {
      await updateWebChatSessionIdentity(sessionId, {
        ...(phone ? { visitorPhone: phone } : {}),
        ...(email ? { visitorEmail: email } : {}),
        ...(params.displayName ? { visitorName: params.displayName } : {}),
      }).catch((err) => console.warn("Failed to update webchat session identity:", err));
    }
  }

  if (channel === "voicebot") {
    const sessionId = parseVoicebotSessionId(participantId);
    if (sessionId) {
      await updateVoicebotSessionIdentity(sessionId, {
        ...(phone ? { visitorPhone: phone } : {}),
        ...(email ? { visitorEmail: email } : {}),
        ...(params.displayName ? { visitorName: params.displayName } : {}),
      }).catch((err) => console.warn("Failed to update voicebot session identity:", err));
    }
  }

  return result;
}
