"use client";

import { useRef, useState } from "react";
import type { BotLocale, LocalizedText } from "@/types";
import { fromLocalizedRecord, toLocalizedRecord } from "@/lib/localized-text";
import { useT } from "@/i18n/context";
import {
  MailrelayHtmlEditor,
  type MailrelayHtmlEditorHandle,
} from "@/components/mailrelay/MailrelayHtmlEditor";

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
  const editorRef = useRef<MailrelayHtmlEditorHandle>(null);
  const record = toLocalizedRecord(value);

  function updateLocale(locale: BotLocale, html: string) {
    onChange(fromLocalizedRecord({ ...record, [locale]: html }));
  }

  function insertField(field: string) {
    const token = `{{form.${field}}}`;
    editorRef.current?.insertAtCursor(token);
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
          ref={editorRef}
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
              onClick={() => insertField(field)}
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
