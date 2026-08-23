"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import {
  useCreateMailrelayTemplate,
  useDeleteMailrelayTemplate,
  useMailrelayTemplates,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type { MailrelayCampaignInput } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

interface MailrelayTemplatesPanelProps {
  connected: boolean;
  draft?: Pick<MailrelayCampaignInput, "name" | "subject" | "previewText" | "html">;
  onApply: (template: {
    name: string;
    subject: string;
    previewText: string;
    html: string;
  }) => void;
}

export function MailrelayTemplatesPanel({ connected, draft, onApply }: MailrelayTemplatesPanelProps) {
  const t = useT();
  const templatesQuery = useMailrelayTemplates(connected);
  const createTemplate = useCreateMailrelayTemplate();
  const deleteTemplate = useDeleteMailrelayTemplate();
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");

  if (!connected) return null;
  if (templatesQuery.isLoading) return <Skeleton className="h-40 w-full" />;

  const templates = templatesQuery.data?.templates ?? [];
  const canSave = Boolean(draft?.html.trim() && draft.subject.trim());

  async function handleSave() {
    if (!draft || !templateName.trim()) {
      setError(t("mailrelay.templates.nameRequired"));
      return;
    }
    try {
      setError("");
      await createTemplate.mutateAsync({
        name: templateName.trim(),
        subject: draft.subject,
        previewText: draft.previewText,
        html: draft.html,
      });
      setTemplateName("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h2 className="font-semibold text-primary">{t("mailrelay.templates.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("mailrelay.templates.description")}</p>
      </div>

      {canSave ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.templates.saveAs")}</span>
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder={t("mailrelay.templates.namePlaceholder")}
            />
          </label>
          <Button onClick={() => void handleSave()} disabled={createTemplate.isPending}>
            {t("mailrelay.templates.save")}
          </Button>
        </div>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t("mailrelay.templates.empty")}
          description={t("mailrelay.templates.emptyDescription")}
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
              <div className="flex gap-2">
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void deleteTemplate.mutateAsync(template.templateId)}
                  disabled={deleteTemplate.isPending}
                  aria-label={t("mailrelay.actions.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
