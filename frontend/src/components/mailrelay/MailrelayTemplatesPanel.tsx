"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText, LayoutTemplate } from "lucide-react";
import { useMailrelayTemplates } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface MailrelayTemplatesPanelProps {
  connected: boolean;
  onApply: (template: {
    name: string;
    subject: string;
    previewText: string;
    html: string;
  }) => void;
  onOpenTemplates?: () => void;
  defaultOpen?: boolean;
}

export function MailrelayTemplatesPanel({
  connected,
  onApply,
  onOpenTemplates,
  defaultOpen = false,
}: MailrelayTemplatesPanelProps) {
  const t = useT();
  const templatesQuery = useMailrelayTemplates(connected);
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");

  const templates = templatesQuery.data?.templates ?? [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        template.subject.toLowerCase().includes(query)
    );
  }, [search, templates]);

  if (!connected) return null;
  if (templatesQuery.isLoading) return <Skeleton className="h-11 w-full" />;
  if (templatesQuery.isError) {
    return <Alert variant="danger">{templatesQuery.error.message}</Alert>;
  }

  return (
    <div className="rounded-xl border border-default bg-surface-muted/40">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-elevated/80"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-primary">
                {t("mailrelay.templates.title")}
              </p>
              {templates.length > 0 ? (
                <span className="shrink-0 rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-secondary">
                  {templates.length}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-secondary">
              {templates.length === 0
                ? t("mailrelay.templates.empty")
                : t("mailrelay.templates.applyShortHint")}
            </p>
          </div>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted",
              open && "bg-surface-elevated"
            )}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {onOpenTemplates ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenTemplates}
            className="shrink-0"
          >
            {t("mailrelay.templates.manage")}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 border-t border-subtle bg-surface-elevated px-3 py-3">
          {templates.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t("mailrelay.templates.empty")}
              description={t("mailrelay.templates.emptyManageDescription")}
            />
          ) : (
            <>
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                placeholder={t("mailrelay.templates.searchPlaceholder")}
              />
              {filtered.length === 0 ? (
                <p className="py-3 text-center text-sm text-secondary">
                  {t("mailrelay.templates.searchEmpty")}
                </p>
              ) : (
                <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((template) => {
                    const subjectDiffers =
                      template.subject.trim() &&
                      template.subject.trim().toLowerCase() !==
                        template.name.trim().toLowerCase();
                    return (
                      <button
                        key={template.templateId}
                        type="button"
                        onClick={() => {
                          onApply({
                            name: template.name,
                            subject: subjectDiffers ? template.subject : template.name,
                            previewText: template.previewText ?? "",
                            html: template.html,
                          });
                          setOpen(false);
                        }}
                        className="rounded-lg border border-default px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-muted/20"
                      >
                        <p className="truncate text-sm font-medium text-primary">
                          {template.name}
                        </p>
                        {subjectDiffers ? (
                          <p className="mt-0.5 truncate text-xs text-secondary">
                            {template.subject}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-accent">
                            {t("mailrelay.templates.apply")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
