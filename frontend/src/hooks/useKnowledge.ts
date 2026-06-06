"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { KnowledgeDocument } from "@/types";

export function useKnowledgeDocuments(botId: string) {
  return useQuery<{ documents: KnowledgeDocument[] }>({
    queryKey: ["knowledge", botId],
    queryFn: () => api.get<{ documents: KnowledgeDocument[] }>(`/bots/${botId}/knowledge`),
    enabled: !!botId,
  });
}

export function useUploadKnowledgeDocument(botId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KnowledgeDocument,
    Error,
    { file: File }
  >({
    mutationFn: async ({ file }) => {
      const { document, uploadUrl } = await api.post<{
        document: KnowledgeDocument;
        uploadUrl: string;
      }>(`/bots/${botId}/knowledge/upload-url`, {
        filename: file.name,
        mimeType: file.type || "text/plain",
        sizeBytes: file.size,
      });

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "text/plain" },
      });

      await api.post(`/bots/${botId}/knowledge/${document.docId}/index`, {});
      return document;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge", botId] });
    },
  });
}

export function useDeleteKnowledgeDocument(botId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (docId) => api.delete(`/bots/${botId}/knowledge/${docId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge", botId] });
    },
  });
}
