import {
  normalizePhone,
  normalizeEmail,
  getContactByEmail,
} from "../dynamodb/contact.repository.js";
import type { Channel, Conversation } from "../../types/index.js";

const PHONE_CHANNELS: Channel[] = ["whatsapp", "sms", "phone"];

export function contactIdFromPhone(phone: string): string | null {
  const normalized = normalizePhone(phone);
  return normalized.length >= 10 ? `phone:${normalized}` : null;
}

export function contactIdFromEmail(email: string): string {
  return `email:${normalizeEmail(email)}`;
}

export function contactIdFromChannelParticipant(channel: Channel, participantId: string): string {
  return `${channel}:${participantId}`;
}

export async function resolveContactId(params: {
  tenantId: string;
  channel: Channel;
  participantId: string;
  phoneNumber?: string;
  email?: string;
}): Promise<string> {
  const phone =
    params.phoneNumber?.trim() ||
    (PHONE_CHANNELS.includes(params.channel) ? params.participantId : undefined);
  if (phone) {
    const id = contactIdFromPhone(phone);
    if (id) return id;
  }

  const email =
    params.email?.trim() ||
    (params.channel === "email" ? params.participantId : undefined);
  if (email) {
    const contact = await getContactByEmail(params.tenantId, email);
    if (contact) {
      const phoneId = contactIdFromPhone(contact.phoneNumber);
      if (phoneId) return phoneId;
    }
    return contactIdFromEmail(email);
  }

  return contactIdFromChannelParticipant(params.channel, params.participantId);
}

export async function resolveContactIdFromConversation(
  tenantId: string,
  conversation: Conversation
): Promise<string> {
  const channel = conversation.channel ?? "whatsapp";
  const participantId = conversation.participantId ?? conversation.phoneNumber;
  return resolveContactId({
    tenantId,
    channel,
    participantId,
    ...(conversation.phoneNumber ? { phoneNumber: conversation.phoneNumber } : {}),
    ...(channel === "email" ? { email: participantId } : {}),
  });
}
