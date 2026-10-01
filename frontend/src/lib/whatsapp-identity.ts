const BSUID_PATTERN = /^[A-Z]{2}(?:\.ENT)?\.[A-Za-z0-9]+$/;

export function isWhatsAppBsuid(value?: string | null): boolean {
  if (!value?.trim()) return false;
  return BSUID_PATTERN.test(value.trim());
}

export function formatWhatsAppUsername(username?: string | null): string | undefined {
  const trimmed = username?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function conversationIdentityLabel(conv: {
  contactName?: string;
  phoneNumber?: string;
  participantId?: string;
  whatsappUsername?: string;
  channel?: string;
}): string {
  if (conv.contactName?.trim()) return conv.contactName.trim();

  const username = formatWhatsAppUsername(conv.whatsappUsername);
  if (username) return username;

  const phone = conv.phoneNumber?.trim();
  if (phone && !isWhatsAppBsuid(phone)) return phone;

  const participant = conv.participantId?.trim();
  if (participant && !isWhatsAppBsuid(participant)) return participant;

  return username || participant || phone || "WhatsApp User";
}

export function conversationSecondaryIdentity(conv: {
  phoneNumber?: string;
  participantId?: string;
  whatsappUsername?: string;
  whatsappUserId?: string;
}): string | undefined {
  const username = formatWhatsAppUsername(conv.whatsappUsername);
  const phone = conv.phoneNumber?.trim();
  if (phone && !isWhatsAppBsuid(phone)) {
    return username && username !== phone ? `${username} · ${phone}` : phone;
  }
  if (username) return username;
  return undefined;
}
