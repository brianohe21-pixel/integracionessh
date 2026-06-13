export function normalizeWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildWaMeLink(phone: string, prefilledText?: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  const base = `https://wa.me/${digits}`;
  if (!prefilledText?.trim()) return base;
  return `${base}?text=${encodeURIComponent(prefilledText.trim())}`;
}
