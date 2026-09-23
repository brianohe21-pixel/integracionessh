import type { WhatsAppContact, WhatsAppMessage } from "../../types/index.js";

const BSUID_PATTERN = /^[A-Z]{2}(?:\.ENT)?\.[A-Za-z0-9]+$/;

export function isWhatsAppBsuid(value: string): boolean {
  return BSUID_PATTERN.test(value.trim());
}

export function resolveInboundParticipantId(
  message: Pick<WhatsAppMessage, "from" | "from_user_id">,
  contact?: Partial<WhatsAppContact> | null
): string | null {
  const from = message.from?.trim();
  if (from) return from;

  const fromUserId = message.from_user_id?.trim();
  if (fromUserId) return fromUserId;

  const waId = contact?.wa_id?.trim();
  if (waId) return waId;

  const userId = contact?.user_id?.trim();
  if (userId) return userId;

  return null;
}

export function buildWhatsAppRecipientFields(to: string): {
  to?: string;
  recipient?: string;
} {
  const trimmed = to.trim();
  if (isWhatsAppBsuid(trimmed)) {
    return { recipient: trimmed };
  }
  return { to: trimmed.replace(/\D/g, "") };
}
