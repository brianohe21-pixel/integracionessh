import type { WhatsAppContact } from "../../types/index.js";
import { isWhatsAppBsuid } from "./identity.js";

const DEFAULT_NAME = "WhatsApp User";

export interface NormalizedWhatsAppContact {
  wa_id: string;
  user_id?: string;
  parent_user_id?: string;
  profile: { name: string; username?: string };
}

export function normalizeWhatsAppContact(
  contact: Partial<WhatsAppContact>,
  fallbackParticipantId: string
): NormalizedWhatsAppContact {
  const contactWaId = contact.wa_id?.trim();
  const contactUserId = contact.user_id?.trim();
  const contactParentUserId = contact.parent_user_id?.trim();
  const fallback = fallbackParticipantId.trim();
  const waId =
    (contactWaId && !isWhatsAppBsuid(contactWaId) ? contactWaId : undefined) ||
    (!isWhatsAppBsuid(fallback) ? fallback : contactWaId) ||
    fallback;
  const userId =
    contactUserId ||
    (isWhatsAppBsuid(fallback) ? fallback : undefined) ||
    (contactWaId && isWhatsAppBsuid(contactWaId) ? contactWaId : undefined);
  const username = contact.profile?.username?.trim();
  return {
    wa_id: waId,
    ...(userId ? { user_id: userId } : {}),
    ...(contactParentUserId ? { parent_user_id: contactParentUserId } : {}),
    profile: {
      name: contact.profile?.name?.trim() || DEFAULT_NAME,
      ...(username ? { username } : {}),
    },
  };
}
