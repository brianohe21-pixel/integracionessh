"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./locales/en";
import { es, type Messages } from "./locales/es";

export type Locale = "es" | "en";

const LOCALE_STORAGE_KEY = "app-locale";

const dictionaries: Record<Locale, Messages> = { es, en };

type TranslationValues = Record<string, string | number>;

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
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    values[key] !== undefined ? String(values[key]) : `{{${key}}}`
  );
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "es";
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "es" || stored === "en") return stored;
  const nav = navigator.language.toLowerCase();
  return nav.startsWith("en") ? "en" : "es";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues) => string;
  messages: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(detectInitialLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const messages = dictionaries[locale];

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const message = getNestedMessage(messages, key) ?? getNestedMessage(dictionaries.es, key) ?? key;
      return interpolate(message, values);
    },
    [messages]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, messages }),
    [locale, setLocale, t, messages]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function useLocale() {
  return useI18n().locale;
}
