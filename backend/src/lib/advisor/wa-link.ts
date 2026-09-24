import { isWhatsAppBsuid } from "../whatsapp/identity.js";

export function isWaMeCompatiblePhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed || isWhatsAppBsuid(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function buildWaMeLink(phone: string, prefilledText?: string): string | null {
  if (!isWaMeCompatiblePhone(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  if (!prefilledText?.trim()) return base;
  return `${base}?text=${encodeURIComponent(prefilledText.trim())}`;
}
