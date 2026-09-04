"use client";

import { useRef, useState } from "react";
import type { BotLocale, LocalizedText } from "@/types";
import { fromLocalizedRecord, toLocalizedRecord } from "@/lib/localized-text";
import { insertIntoText } from "@/lib/text-insert";
import { useT } from "@/i18n/context";

interface LocalizedTextFieldProps {
  value: LocalizedText | undefined;
  onChange: (value: LocalizedText) => void;
  rows?: number;
  placeholder?: string;
  sampleFields?: string[];
  hint?: string;
}

export function LocalizedTextField({
  value,
  onChange,
  rows = 3,
  placeholder,
  sampleFields = [],
  hint,
}: LocalizedTextFieldProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<BotLocale>("es");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const record = toLocalizedRecord(value);

  function updateLocale(locale: BotLocale, text: string) {
    onChange(fromLocalizedRecord({ ...record, [locale]: text }));
  }

  function insertField(field: string) {
    const token = `{{form.${field}}}`;
    const current = record[activeTab];
    const el = textareaRef.current;
    if (!el) {
      updateLocale(activeTab, current.trim() ? `${current} ${token}` : token);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const { text, cursor } = insertIntoText(current, token, start, end);
    updateLocale(activeTab, text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
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
                : "bg-surface text-secondary border border-field-border"
            }`}
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={record[activeTab]}
        onChange={(e) => updateLocale(activeTab, e.target.value)}
        placeholder={placeholder ?? t("flows.fields.localizedPlaceholder")}
        rows={rows}
        className="w-full rounded-lg border border-field-border bg-surface-elevated px-3 py-2 text-sm shadow-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
      />
      {sampleFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sampleFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => insertField(field)}
              className="rounded-md border border-field-border px-2 py-0.5 text-[10px] text-secondary hover:border-accent/40 hover:text-primary"
            >
              {field}
            </button>
          ))}
        </div>
      )}
      {hint ? (
        <p className="text-xs text-secondary">{hint}</p>
      ) : activeTab === "es" && record.en.trim() ? (
        <p className="text-xs text-secondary">{t("flows.fields.localizedHint")}</p>
      ) : null}
    </div>
  );
}
