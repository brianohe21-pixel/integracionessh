import { en } from "./locales/en";
import { es, type Messages } from "./locales/es";

const LOCALE_STORAGE_KEY = "app-locale";

export type Locale = "es" | "en";

const dictionaries: Record<Locale, Messages> = { es, en };

type TranslationValues = Record<string, string | number>;

function detectLocale(): Locale {
  if (typeof window === "undefined") return "es";
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "es" || stored === "en") return stored;
  const nav = navigator.language.toLowerCase();
  return nav.startsWith("en") ? "en" : "es";
}

function getNestedMessage(obj: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      values[key] !== undefined ? String(values[key]) : `{{${key}}}`
    )
    .replace(/\{(\w+)\}/g, (_, key: string) =>
      values[key] !== undefined ? String(values[key]) : `{${key}}}`
    );
}

export function translate(key: string, values?: TranslationValues): string {
  const locale = detectLocale();
  const message =
    getNestedMessage(dictionaries[locale], key) ??
    getNestedMessage(dictionaries.es, key) ??
    key;
  return interpolate(message, values);
}
