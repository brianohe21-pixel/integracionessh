export function buildWaMeLink(phone: string, prefilledText?: string): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  if (!prefilledText?.trim()) return base;
  return `${base}?text=${encodeURIComponent(prefilledText.trim())}`;
}
