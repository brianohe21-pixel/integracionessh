"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Message } from "@/types";

export const CONVERSATION_ATTACHMENT_MAX_BYTES = 16 * 1024 * 1024;

export const CONVERSATION_ATTACHMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

export function validateConversationAttachmentFile(file: File): string | null {
  if (file.size <= 0) return "empty";
  if (file.size > CONVERSATION_ATTACHMENT_MAX_BYTES) return "tooLarge";

  const lower = file.name.toLowerCase();
  const allowed =
    lower.endsWith(".pdf") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp");

  if (!allowed) return "unsupported";
  return null;
}

export function useSendConversationAttachment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      conversationId: string;
      botId: string;
      file: File;
      caption?: string;
    }) => {
      const validationError = validateConversationAttachmentFile(body.file);
      if (validationError) {
        throw new Error(validationError);
      }

      const mimeType = body.file.type || "application/octet-stream";
      const { uploadUrl, attachmentId, s3Key } = await api.post<{
        uploadUrl: string;
        attachmentId: string;
        s3Key: string;
      }>(
        `/conversations/${encodeURIComponent(body.conversationId)}/attachments/upload-url`,
        {
          botId: body.botId,
          filename: body.file.name,
          mimeType,
          sizeBytes: body.file.size,
        }
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: body.file,
        headers: {
          "Content-Type": mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("uploadFailed");
      }

      return api.post<Message>(
        `/conversations/${encodeURIComponent(body.conversationId)}/attachments/send`,
        {
          botId: body.botId,
          attachmentId,
          s3Key,
          filename: body.file.name,
          mimeType,
          ...(body.caption?.trim() ? { caption: body.caption.trim() } : {}),
        }
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
