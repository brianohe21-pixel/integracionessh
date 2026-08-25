"use client";

import { useState } from "react";
import type { BotLocale, LocalizedText } from "@/types";
import { fromLocalizedRecord, toLocalizedRecord } from "@/lib/localized-text";
import { useT } from "@/i18n/context";
import { MailrelayHtmlEditor } from "@/components/mailrelay/MailrelayHtmlEditor";

interface LocalizedHtmlFieldProps {
  value: LocalizedText | undefined;
  onChange: (value: LocalizedText) => void;
  placeholder?: string;
  sampleFields?: string[];
  hint?: string;
}

export function LocalizedHtmlField({
  value,
  onChange,
  placeholder,
  sampleFields = [],
  hint,
}: LocalizedHtmlFieldProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<BotLocale>("es");
  const record = toLocalizedRecord(value);

  function updateLocale(locale: BotLocale, html: string) {
    onChange(fromLocalizedRecord({ ...record, [locale]: html }));
  }

  function appendField(locale: BotLocale, field: string) {
    const token = `{{form.${field}}}`;
    const current = record[locale];
    updateLocale(locale, current.trim() ? `${current} ${token}` : token);
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
      <div className="[&_.mailrelay-html-editor]:!border-field-border">
        <MailrelayHtmlEditor
          value={record[activeTab]}
          onChange={(html) => updateLocale(activeTab, html)}
          placeholder={placeholder ?? t("flows.fields.localizedPlaceholder")}
        />
      </div>
      {sampleFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sampleFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => appendField(activeTab, field)}
              className="rounded-md border border-field-border px-2 py-0.5 text-[10px] text-secondary hover:border-accent/40 hover:text-primary"
            >
              {field}
            </button>
          ))}
        </div>
      )}
      {hint ? <p className="text-xs text-secondary">{hint}</p> : null}
      {!hint && activeTab === "es" && record.en.trim() && (
        <p className="text-xs text-secondary">{t("flows.fields.localizedHint")}</p>
      )}
    </div>
  );
}
