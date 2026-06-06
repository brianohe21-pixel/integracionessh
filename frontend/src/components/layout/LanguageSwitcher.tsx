"use client";

import { useI18n, type Locale } from "@/i18n/context";
import { cn } from "@/lib/utils";

const options: { value: Locale; labelKey: "common.spanish" | "common.english" }[] = [
  { value: "es", labelKey: "common.spanish" },
  { value: "en", labelKey: "common.english" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg p-0.5 bg-gray-100"
      role="group"
      aria-label={t("common.language")}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLocale(opt.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            locale === opt.value
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}
