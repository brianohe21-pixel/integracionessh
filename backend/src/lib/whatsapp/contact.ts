import type { WhatsAppContact } from "../../types/index.js";

const DEFAULT_NAME = "WhatsApp User";

export interface NormalizedWhatsAppContact {
  wa_id: string;
  profile: { name: string };
}

export function normalizeWhatsAppContact(
  contact: Partial<WhatsAppContact> & { wa_id: string }
): NormalizedWhatsAppContact {
  return {
    wa_id: contact.wa_id,
    profile: { name: contact.profile?.name?.trim() || DEFAULT_NAME },
  };
}
