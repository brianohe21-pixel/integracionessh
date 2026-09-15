"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Message } from "@/types";

export const CONVERSATION_ATTACHMENT_MAX_BYTES = 16 * 1024 * 1024;

export const CONVERSATION_ATTACHMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/aac,audio/amr,audio/ogg,.pdf,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.aac,.amr,.ogg,.opus";

export function isAudioAttachmentFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith(".mp3") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".aac") ||
    lower.endsWith(".amr") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".opus")
  ) {
    return true;
  }
  const mime = file.type.trim().toLowerCase();
  return (
    mime === "audio/mpeg" ||
    mime === "audio/mp4" ||
    mime === "audio/aac" ||
    mime === "audio/amr" ||
    mime === "audio/ogg"
  );
}

export function validateConversationAttachmentFile(file: File): string | null {
  if (file.size <= 0) return "empty";
  if (file.size > CONVERSATION_ATTACHMENT_MAX_BYTES) return "tooLarge";

  const lower = file.name.toLowerCase();
  const allowed =
    lower.endsWith(".pdf") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".aac") ||
    lower.endsWith(".amr") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".opus");

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
      voiceNote?: boolean;
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
          ...(body.voiceNote ? { voiceNote: true } : {}),
        }
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
