import type { BotLocale, LocalizedText } from "./types.js";
import { isLocalizedObject } from "./types.js";

export function resolveLocalizedText(
  value: LocalizedText | undefined,
  locale: BotLocale,
  fallbackLocale: BotLocale = "es"
): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (!isLocalizedObject(value)) return "";

  const primary = value[locale]?.trim();
  if (primary) return primary;

  const fallback = value[fallbackLocale]?.trim();
  if (fallback) return fallback;

  return value.es?.trim() || value.en?.trim() || "";
}

export function templateLanguageForLocale(locale: BotLocale): string {
  return locale === "en" ? "en" : "es";
}

export function intlLocaleForBot(locale: BotLocale): string {
  return locale === "en" ? "en-US" : "es-CO";
}

export function getBotLocale(
  conversation: { locale?: BotLocale },
  bot?: { defaultLocale?: BotLocale }
): BotLocale {
  return conversation.locale ?? bot?.defaultLocale ?? "es";
}
