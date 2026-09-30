"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface FlowMediaUploadResult {
  mediaId: string;
  s3Key: string;
  mimeType: string;
  filename: string;
}

export function useFlowMediaUpload(flowId: string) {
  return useMutation<FlowMediaUploadResult, Error, { file: File }>({
    mutationFn: async ({ file }) => {
      const { mediaId, s3Key, uploadUrl, mimeType, filename } = await api.post<{
        mediaId: string;
        s3Key: string;
        uploadUrl: string;
        mimeType: string;
        filename: string;
      }>(`/flows/${encodeURIComponent(flowId)}/media/upload-url`, {
        filename: file.name,
        mimeType: file.type || "audio/ogg",
        sizeBytes: file.size,
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": mimeType },
      });
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload voice note");
      }

      return { mediaId, s3Key, mimeType, filename };
    },
  });
}
