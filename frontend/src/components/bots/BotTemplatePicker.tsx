"use client";

import { cn } from "@/lib/utils";
import { BOT_INDUSTRY_TEMPLATES } from "@/lib/bot-templates";
import type { BotIndustryTemplateId } from "@/lib/bot-templates";
import { useT } from "@/i18n/context";
import { SlidersHorizontal } from "lucide-react";

interface BotTemplatePickerProps {
  value: BotIndustryTemplateId | null;
  onChange: (value: BotIndustryTemplateId | null) => void;
}

export function BotTemplatePicker({ value, onChange }: BotTemplatePickerProps) {
  const t = useT();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-secondary">{t("botTemplates.title")}</h3>
        <p className="mt-1 text-xs text-muted">{t("botTemplates.description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
            value === null
              ? "border-accent bg-accent-muted/30 ring-1 ring-accent"
              : "border-default bg-surface-elevated hover:border-accent/40"
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
            <SlidersHorizontal className="h-5 w-5 text-secondary" />
          </span>
          <span>
            <span className="block text-sm font-medium text-primary">{t("botTemplates.custom")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("botTemplates.customDescription")}</span>
          </span>
        </button>

        {BOT_INDUSTRY_TEMPLATES.map((template) => {
          const Icon = template.icon;
          const selected = value === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-accent bg-accent-muted/30 ring-1 ring-accent"
                  : "border-default bg-surface-elevated hover:border-accent/40"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                <Icon className="h-5 w-5 text-accent" />
              </span>
              <span>
                <span className="block text-sm font-medium text-primary">
                  {t(`botTemplates.${template.id}.name`)}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {t(`botTemplates.${template.id}.description`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
