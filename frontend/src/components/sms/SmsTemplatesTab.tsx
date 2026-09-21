"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { useMemo } from "react";
import { useTemplates } from "@/hooks/useTemplates";
import { useT } from "@/i18n/context";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { isSmsTemplate } from "@/types";

export function SmsTemplatesTab() {
  const t = useT();
  const { data: templates = [], isLoading, error } = useTemplates(undefined, "sms");
  const smsTemplates = useMemo(
    () => templates.filter((template) => isSmsTemplate(template)),
    [templates]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">{t("smsDashboard.templates.title")}</h2>
          <p className="mt-1 text-xs text-secondary">{t("smsDashboard.templates.subtitle")}</p>
        </div>
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          {t("smsDashboard.templates.manage")}
        </Link>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t("templates.loadError")}
        </div>
      ) : null}

      {!isLoading && !error && smsTemplates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={t("smsDashboard.templates.empty")}
          description={t("smsDashboard.templates.emptyHint")}
          action={
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              {t("smsDashboard.templates.manage")}
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && smsTemplates.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {smsTemplates.map((template) => (
            <div
              key={`${template.botId}-${template.name}-${template.language}`}
              className="rounded-xl border border-default bg-surface-elevated p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-primary">{template.name}</p>
                  <p className="text-xs text-secondary">
                    {template.language} · {template.botId}
                  </p>
                </div>
                <Link href="/templates" className="text-sm text-accent hover:underline">
                  {t("common.edit")}
                </Link>
              </div>
              <SmsTemplatePreview template={template} label={t("templates.previewLabel")} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
