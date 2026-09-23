import type { WhatsAppContact } from "../../types/index.js";

const DEFAULT_NAME = "WhatsApp User";

export interface NormalizedWhatsAppContact {
  wa_id: string;
  user_id?: string;
  profile: { name: string; username?: string };
}

export function normalizeWhatsAppContact(
  contact: Partial<WhatsAppContact>,
  fallbackParticipantId: string
): NormalizedWhatsAppContact {
  const waId = contact.wa_id?.trim() || fallbackParticipantId;
  const userId = contact.user_id?.trim();
  const username = contact.profile?.username?.trim();
  return {
    wa_id: waId,
    ...(userId ? { user_id: userId } : {}),
    profile: {
      name: contact.profile?.name?.trim() || DEFAULT_NAME,
      ...(username ? { username } : {}),
    },
  };
}
