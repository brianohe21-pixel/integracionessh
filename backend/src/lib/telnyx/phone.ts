const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function normalizeE164(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return E164_PATTERN.test(digits) ? digits : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function isValidE164(phone: string): boolean {
  return E164_PATTERN.test(normalizeE164(phone));
}

export function telnyxLookupNumber(phone: string): string {
  return normalizeE164(phone);
}
