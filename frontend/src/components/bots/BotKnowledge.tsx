"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useKnowledgeDocuments, useUploadKnowledgeDocument, useDeleteKnowledgeDocument } from "@/hooks/useKnowledge";
import { useSaveAiAssistant } from "@/hooks/useAiAssistant";
import { KNOWLEDGE_ACCEPT } from "@/lib/knowledge-upload";
import { useT } from "@/i18n/context";
import type { Bot, Tenant } from "@/types";

export function BotKnowledge({
  bot,
  knowledgeEnabled,
  showToggle = true,
  title,
  subtitle,
  enabledLabel,
  onKnowledgeEnabledChange,
}: {
  bot: Bot;
  knowledgeEnabled?: boolean;
  showToggle?: boolean;
  title?: string;
  subtitle?: string;
  enabledLabel?: string;
  onKnowledgeEnabledChange?: (enabled: boolean) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const { data, isLoading } = useKnowledgeDocuments(bot.botId);
  const upload = useUploadKnowledgeDocument(bot.botId);
  const remove = useDeleteKnowledgeDocument(bot.botId);
  const saveAiAssistant = useSaveAiAssistant(bot.botId);

  const documents = data?.documents ?? [];
  const enabled = knowledgeEnabled ?? bot.knowledgeEnabled ?? false;
  const sectionTitle = title ?? t("knowledge.title");
  const sectionSubtitle = subtitle ?? t("knowledge.subtitle");
  const sectionEnabledLabel = enabledLabel ?? t("knowledge.enabled");

  if (tenant?.plan === "free") {
    return (
      <div className="bg-surface-elevated rounded-xl border border-default p-6">
        <h2 className="text-lg font-semibold text-primary">{sectionTitle}</h2>
        <p className="text-sm text-secondary mt-2">{t("knowledge.planRequired")}</p>
      </div>
    );
  }

  async function handleFile(file: File) {
    await upload.mutateAsync({ file });
    if (!enabled) {
      if (onKnowledgeEnabledChange) {
        onKnowledgeEnabledChange(true);
      } else {
        saveAiAssistant.mutate({ knowledgeEnabled: true });
      }
    }
  }

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">{sectionTitle}</h2>
          <p className="text-sm text-secondary">{sectionSubtitle}</p>
        </div>
        {showToggle && (
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                const next = e.target.checked;
                if (onKnowledgeEnabledChange) {
                  onKnowledgeEnabledChange(next);
                  return;
                }
                saveAiAssistant.mutate({ knowledgeEnabled: next });
              }}
              className="rounded border-default"
            />
            {sectionEnabledLabel}
          </label>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={KNOWLEDGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent-muted disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {upload.isPending ? t("knowledge.uploading") : t("knowledge.upload")}
      </button>

      {isLoading ? (
        <div className="h-20 animate-pulse bg-surface rounded-lg" />
      ) : documents.length === 0 ? (
        <p className="text-sm text-secondary">{t("knowledge.empty")}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <li key={doc.docId} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-muted shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{doc.filename}</p>
                  <p className="text-xs text-secondary">
                    {doc.status} · {(doc.sizeBytes / 1024).toFixed(1)} KB
                    {doc.chunkCount > 0 ? ` · ${doc.chunkCount} chunks` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(doc.docId)}
                className="p-2 text-muted hover:text-red-600"
                aria-label={t("common.delete")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
