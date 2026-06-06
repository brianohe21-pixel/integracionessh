"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useKnowledgeDocuments, useUploadKnowledgeDocument, useDeleteKnowledgeDocument } from "@/hooks/useKnowledge";
import { useUpdateBot } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import type { Bot, Tenant } from "@/types";

export function BotKnowledge({ bot }: { bot: Bot }) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const { data, isLoading } = useKnowledgeDocuments(bot.botId);
  const upload = useUploadKnowledgeDocument(bot.botId);
  const remove = useDeleteKnowledgeDocument(bot.botId);
  const updateBot = useUpdateBot(bot.botId);

  const documents = data?.documents ?? [];

  if (tenant?.plan === "free") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t("knowledge.title")}</h2>
        <p className="text-sm text-gray-500 mt-2">{t("knowledge.planRequired")}</p>
      </div>
    );
  }

  async function handleFile(file: File) {
    await upload.mutateAsync({ file });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("knowledge.title")}</h2>
          <p className="text-sm text-gray-500">{t("knowledge.subtitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={bot.knowledgeEnabled ?? false}
            onChange={(e) => updateBot.mutate({ knowledgeEnabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          {t("knowledge.enabled")}
        </label>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,text/plain,text/markdown"
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
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {upload.isPending ? t("knowledge.uploading") : t("knowledge.upload")}
      </button>

      {isLoading ? (
        <div className="h-20 animate-pulse bg-gray-50 rounded-lg" />
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray-500">{t("knowledge.empty")}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <li key={doc.docId} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-500">
                    {doc.status} · {(doc.sizeBytes / 1024).toFixed(1)} KB
                    {doc.chunkCount > 0 ? ` · ${doc.chunkCount} chunks` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(doc.docId)}
                className="p-2 text-gray-400 hover:text-red-600"
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
