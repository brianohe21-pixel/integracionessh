"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/i18n/context";
import { LocalizedTextField } from "@/components/ui/LocalizedTextField";
import { resolveLocalizedText } from "@/lib/localized-text";
import { cn } from "@/lib/utils";
import type { FlowNodeData, LocalizedText } from "@/types";
import { WhatsAppListPreview } from "./WhatsAppListPreview";

type Props = {
  data: FlowNodeData;
  onUpdate: (patch: Record<string, unknown>) => void;
};

type EditorTab = "message" | "options";

const LIMITS = {
  message: 1024,
  button: 20,
  section: 24,
  header: 60,
  footer: 60,
  title: 24,
  description: 72,
  maxItems: 10,
} as const;

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <label className="block text-sm font-medium text-primary">{children}</label>
      {hint ? <span className="text-[10px] tabular-nums text-muted">{hint}</span> : null}
    </div>
  );
}

function charHint(value: LocalizedText | undefined, locale: "es" | "en", max: number) {
  const len = [...resolveLocalizedText(value, locale)].length;
  return `${len}/${max}`;
}

export function ListNodeFields({ data: d, onUpdate }: Props) {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<EditorTab>("options");
  const items = d.listItems ?? [{ id: "row-1", title: "", description: "" }];

  function updateItem(index: number, patch: Partial<(typeof items)[number]>) {
    const listItems = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onUpdate({ listItems });
  }

  function removeItem(index: number) {
    onUpdate({ listItems: items.filter((_, i) => i !== index) });
  }

  function addItem() {
    if (items.length >= LIMITS.maxItems) return;
    onUpdate({
      listItems: [...items, { id: `row-${Date.now()}`, title: "", description: "" }],
    });
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {t("flows.hints.listBranches")}
        </p>

        <div className="flex gap-1 rounded-lg border border-field-border bg-surface-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTab("options")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              tab === "options"
                ? "bg-surface-elevated text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            )}
          >
            {t("flows.fields.listOptionsSection")}
            <span className="ml-1 tabular-nums text-muted">
              ({items.length}/{LIMITS.maxItems})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("message")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              tab === "message"
                ? "bg-surface-elevated text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            )}
          >
            {t("flows.fields.listMessageSection")}
          </button>
        </div>

        {tab === "options" ? (
          <section className="space-y-3">
            <div className="space-y-2.5">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="space-y-2.5 rounded-xl border border-field-border bg-surface-elevated p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-secondary">
                      {t("flows.fields.listItem")} {i + 1}
                    </p>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("flows.fields.removeListItem")}
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel hint={charHint(item.title, locale, LIMITS.title)}>
                      {t("flows.fields.listItemTitle")}
                    </FieldLabel>
                    <LocalizedTextField
                      value={item.title}
                      onChange={(v) => updateItem(i, { title: v })}
                      rows={1}
                      allowEmoji
                    />
                  </div>
                  <div>
                    <FieldLabel hint={charHint(item.description, locale, LIMITS.description)}>
                      {t("flows.fields.listItemDescription")}
                    </FieldLabel>
                    <LocalizedTextField
                      value={item.description}
                      onChange={(v) => updateItem(i, { description: v })}
                      rows={2}
                      allowEmoji
                    />
                  </div>
                </div>
              ))}
            </div>

            {items.length < LIMITS.maxItems ? (
              <button
                type="button"
                onClick={addItem}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("flows.fields.addListItem")}
              </button>
            ) : null}
          </section>
        ) : (
          <section className="space-y-3 rounded-xl border border-field-border bg-surface-muted/20 p-3">
            <div>
              <FieldLabel hint={charHint(d.messageText, locale, LIMITS.message)}>
                {t("flows.fields.messageText")}
              </FieldLabel>
              <LocalizedTextField
                value={d.messageText}
                onChange={(v) => onUpdate({ messageText: v })}
                rows={2}
                allowEmoji
              />
            </div>
            <div>
              <FieldLabel hint={charHint(d.listButtonText, locale, LIMITS.button)}>
                {t("flows.fields.listButtonText")}
              </FieldLabel>
              <LocalizedTextField
                value={d.listButtonText}
                onChange={(v) => onUpdate({ listButtonText: v })}
                rows={1}
                allowEmoji
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel hint={charHint(d.listHeaderText, locale, LIMITS.header)}>
                  {t("flows.fields.listHeaderText")}
                </FieldLabel>
                <LocalizedTextField
                  value={d.listHeaderText}
                  onChange={(v) => onUpdate({ listHeaderText: v })}
                  rows={1}
                  allowEmoji
                />
              </div>
              <div>
                <FieldLabel hint={charHint(d.listFooterText, locale, LIMITS.footer)}>
                  {t("flows.fields.listFooterText")}
                </FieldLabel>
                <LocalizedTextField
                  value={d.listFooterText}
                  onChange={(v) => onUpdate({ listFooterText: v })}
                  rows={1}
                  allowEmoji
                />
              </div>
            </div>
            <div>
              <FieldLabel hint={charHint(d.listSectionTitle, locale, LIMITS.section)}>
                {t("flows.fields.listSectionTitle")}
              </FieldLabel>
              <LocalizedTextField
                value={d.listSectionTitle}
                onChange={(v) => onUpdate({ listSectionTitle: v })}
                rows={1}
                allowEmoji
              />
            </div>
          </section>
        )}
      </div>

      <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[340px]">
        <WhatsAppListPreview
          messageText={d.messageText}
          buttonText={d.listButtonText}
          sectionTitle={d.listSectionTitle}
          headerText={d.listHeaderText}
          footerText={d.listFooterText}
          items={items}
          compact
        />
      </aside>
    </div>
  );
}
