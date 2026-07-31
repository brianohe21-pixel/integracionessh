import type { BotLocale, LocalizedText } from "@/types";

export function isLocalizedObject(
  value: LocalizedText | undefined
): value is Record<BotLocale, string> {
  return typeof value === "object" && value !== null && ("es" in value || "en" in value);
}

export function toLocalizedRecord(value: LocalizedText | undefined): Record<BotLocale, string> {
  if (!value) return { es: "", en: "" };
  if (typeof value === "string") return { es: value, en: value };
  return { es: value.es ?? "", en: value.en ?? "" };
}

export function fromLocalizedRecord(record: Record<BotLocale, string>): LocalizedText {
  const es = record.es.trim();
  const en = record.en.trim();
  if (es && es === en) return es;
  if (!es && !en) return "";
  return { es, en };
}

export function resolveLocalizedText(
  value: LocalizedText | undefined,
  locale: BotLocale,
  fallbackLocale: BotLocale = "es"
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const primary = value[locale]?.trim();
  if (primary) return primary;
  const fallback = value[fallbackLocale]?.trim();
  if (fallback) return fallback;
  return value.es?.trim() || value.en?.trim() || "";
}
