export function isWaMeCompatiblePhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  if (/^[A-Z]{2}(?:\.ENT)?\.[A-Za-z0-9]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildWaMeLink(phone: string, prefilledText?: string): string | null {
  if (!isWaMeCompatiblePhone(phone)) return null;
  const digits = normalizeWhatsAppPhone(phone);
  const base = `https://wa.me/${digits}`;
  if (!prefilledText?.trim()) return base;
  return `${base}?text=${encodeURIComponent(prefilledText.trim())}`;
}
