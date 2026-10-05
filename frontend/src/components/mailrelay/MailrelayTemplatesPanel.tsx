"use client";

import { FileText } from "lucide-react";
import { useMailrelayTemplates } from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface MailrelayTemplatesPanelProps {
  connected: boolean;
  onApply: (template: {
    name: string;
    subject: string;
    previewText: string;
    html: string;
  }) => void;
  onOpenTemplates?: () => void;
}

export function MailrelayTemplatesPanel({
  connected,
  onApply,
  onOpenTemplates,
}: MailrelayTemplatesPanelProps) {
  const t = useT();
  const templatesQuery = useMailrelayTemplates(connected);

  if (!connected) return null;
  if (templatesQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  if (templatesQuery.isError) {
    return <Alert variant="danger">{templatesQuery.error.message}</Alert>;
  }

  const templates = templatesQuery.data?.templates ?? [];

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">{t("mailrelay.templates.title")}</h2>
          <p className="mt-1 text-sm text-secondary">{t("mailrelay.templates.applyDescription")}</p>
        </div>
        {onOpenTemplates ? (
          <Button variant="secondary" size="sm" onClick={onOpenTemplates}>
            {t("mailrelay.templates.manage")}
          </Button>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t("mailrelay.templates.empty")}
          description={t("mailrelay.templates.emptyManageDescription")}
        />
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.templateId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-primary">{template.name}</p>
                <p className="truncate text-sm text-secondary">{template.subject}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  onApply({
                    name: template.name,
                    subject: template.subject,
                    previewText: template.previewText ?? "",
                    html: template.html,
                  })
                }
              >
                {t("mailrelay.templates.apply")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
