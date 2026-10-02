import type {
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppSystemMessage,
} from "../../types/index.js";

const BSUID_PATTERN = /^[A-Z]{2}(?:\.ENT)?\.[A-Za-z0-9]+$/;

export function isWhatsAppBsuid(value: string): boolean {
  return BSUID_PATTERN.test(value.trim());
}

export function normalizeWhatsAppPhoneId(value: string): string {
  return value.trim().replace(/\D/g, "");
}

export function normalizeWhatsAppRecipientId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isWhatsAppBsuid(trimmed)) return trimmed;
  return normalizeWhatsAppPhoneId(trimmed);
}

export type WhatsAppIdentities = {
  participantId: string;
  phoneNumber?: string;
  whatsappUserId?: string;
  whatsappParentUserId?: string;
  whatsappUsername?: string;
  lookupIds: string[];
};

export function formatWhatsAppUsername(username?: string | null): string | undefined {
  const trimmed = username?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function resolveWhatsAppOutboundRecipient(params: {
  participantId?: string | null;
  phoneNumber?: string | null;
  whatsappUserId?: string | null;
}): string {
  const bsuid =
    params.whatsappUserId?.trim() ||
    (params.participantId && isWhatsAppBsuid(params.participantId)
      ? params.participantId.trim()
      : undefined);
  if (bsuid) return bsuid;

  const phone = params.phoneNumber?.trim();
  if (phone && !isWhatsAppBsuid(phone)) {
    return normalizeWhatsAppPhoneId(phone) || phone;
  }

  const fallback = params.participantId?.trim() || phone || "";
  return isWhatsAppBsuid(fallback) ? fallback : normalizeWhatsAppPhoneId(fallback) || fallback;
}

function uniqueIds(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function resolveWhatsAppIdentities(
  message: Pick<WhatsAppMessage, "from" | "from_user_id" | "from_parent_user_id">,
  contact?: Partial<WhatsAppContact> | null
): WhatsAppIdentities | null {
  const phoneCandidates = uniqueIds([message.from, contact?.wa_id]).filter(
    (value) => !isWhatsAppBsuid(value)
  );

  const phoneNumber = phoneCandidates
    .map((value) => normalizeWhatsAppPhoneId(value) || value.trim())
    .find((value) => Boolean(value));

  const whatsappUserId = uniqueIds([
    message.from_user_id,
    contact?.user_id,
    message.from,
    contact?.wa_id,
  ]).find((value) => isWhatsAppBsuid(value));

  const whatsappParentUserId = uniqueIds([
    message.from_parent_user_id,
    contact?.parent_user_id,
  ]).find((value) => isWhatsAppBsuid(value));

  const whatsappUsername = formatWhatsAppUsername(contact?.profile?.username);

  const participantId = whatsappUserId ?? phoneNumber;
  if (!participantId) return null;

  return {
    participantId,
    ...(phoneNumber ? { phoneNumber } : {}),
    ...(whatsappUserId ? { whatsappUserId } : {}),
    ...(whatsappParentUserId ? { whatsappParentUserId } : {}),
    ...(whatsappUsername ? { whatsappUsername } : {}),
    lookupIds: uniqueIds([
      participantId,
      whatsappUserId,
      whatsappParentUserId,
      phoneNumber,
    ]),
  };
}

export function resolveInboundParticipantId(
  message: Pick<WhatsAppMessage, "from" | "from_user_id" | "from_parent_user_id">,
  contact?: Partial<WhatsAppContact> | null
): string | null {
  return resolveWhatsAppIdentities(message, contact)?.participantId ?? null;
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

export type WhatsAppIdentityChange = {
  type: "user_changed_number" | "user_changed_user_id";
  previousUserId?: string;
  userId?: string;
  previousParentUserId?: string;
  parentUserId?: string;
  previousWaId?: string;
  waId?: string;
};

export function extractWhatsAppIdentityChange(
  message: Pick<WhatsAppMessage, "type" | "system">
): WhatsAppIdentityChange | null {
  if (message.type !== "system" || !message.system) return null;
  const system = message.system as WhatsAppSystemMessage;
  const type = system.type?.trim();
  if (type !== "user_changed_number" && type !== "user_changed_user_id") return null;

  return {
    type,
    ...(system.previous_user_id?.trim()
      ? { previousUserId: system.previous_user_id.trim() }
      : {}),
    ...(system.user_id?.trim() ? { userId: system.user_id.trim() } : {}),
    ...(system.previous_parent_user_id?.trim()
      ? { previousParentUserId: system.previous_parent_user_id.trim() }
      : {}),
    ...(system.parent_user_id?.trim()
      ? { parentUserId: system.parent_user_id.trim() }
      : {}),
    ...(system.previous_wa_id?.trim()
      ? { previousWaId: normalizeWhatsAppPhoneId(system.previous_wa_id) || system.previous_wa_id.trim() }
      : {}),
    ...(system.wa_id?.trim()
      ? { waId: normalizeWhatsAppPhoneId(system.wa_id) || system.wa_id.trim() }
      : {}),
  };
}

export function isWhatsAppIdentityChangeMessage(
  message: Pick<WhatsAppMessage, "type" | "system">
): boolean {
  return extractWhatsAppIdentityChange(message) !== null;
}
