"use client";

import { useState } from "react";
import type { BotLocale, LocalizedText } from "@/types";
import { fromLocalizedRecord, toLocalizedRecord } from "@/lib/localized-text";
import { useT } from "@/i18n/context";

interface LocalizedTextFieldProps {
  value: LocalizedText | undefined;
  onChange: (value: LocalizedText) => void;
  rows?: number;
  placeholder?: string;
}

export function LocalizedTextField({
  value,
  onChange,
  rows = 3,
  placeholder,
}: LocalizedTextFieldProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<BotLocale>("es");
  const record = toLocalizedRecord(value);

  function updateLocale(locale: BotLocale, text: string) {
    onChange(fromLocalizedRecord({ ...record, [locale]: text }));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["es", "en"] as const).map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => setActiveTab(locale)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              activeTab === locale
                ? "bg-accent text-white"
                : "bg-surface text-secondary border border-default"
            }`}
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
      <textarea
        value={record[activeTab]}
        onChange={(e) => updateLocale(activeTab, e.target.value)}
        placeholder={placeholder ?? t("flows.fields.localizedPlaceholder")}
        rows={rows}
        className="w-full rounded-lg border border-default px-3 py-2 text-sm"
      />
      {activeTab === "es" && record.en.trim() && (
        <p className="text-xs text-secondary">{t("flows.fields.localizedHint")}</p>
      )}
    </div>
  );
}
