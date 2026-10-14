import type { Contact, Conversation } from "../../types/index.js";
import { getContactByPhone, normalizePhone } from "../dynamodb/contact.repository.js";

export function contactPredatesConversation(
  contact: Contact,
  conversation: Pick<Conversation, "createdAt">
): boolean {
  return contact.createdAt < conversation.createdAt;
}

export async function resolveIsKnownContact(params: {
  tenantId: string;
  phone?: string | null;
  conversation?: Pick<Conversation, "createdAt" | "phoneNumber" | "participantId"> | null;
  participantId?: string | null;
}): Promise<{ isKnown: boolean; phone: string | null }> {
  const rawPhone =
    params.phone?.trim() ||
    params.conversation?.phoneNumber?.trim() ||
    params.participantId?.trim() ||
    params.conversation?.participantId?.trim() ||
    "";

  if (!rawPhone) return { isKnown: false, phone: null };

  const phone = normalizePhone(rawPhone);
  if (!phone || phone.startsWith("CO.")) return { isKnown: false, phone: null };

  const contact = await getContactByPhone(params.tenantId, phone);
  if (!contact) return { isKnown: false, phone };

  if (params.conversation?.createdAt) {
    return {
      isKnown: contactPredatesConversation(contact, params.conversation),
      phone,
    };
  }

  return { isKnown: true, phone };
}
