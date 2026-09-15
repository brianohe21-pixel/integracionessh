"use client";

import { useMutation } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { ChatAudioPlayer } from "@/components/conversations/ChatAudioPlayer";
import {
  getDocumentMetadata,
  isAudioAttachmentMessage,
  isImageAttachmentMessage,
} from "@/lib/conversations/document-messages";
import { useT } from "@/i18n/context";
import type { Message } from "@/types";

type Props = {
  message: Message;
  conversationId: string;
  botId: string;
};

export function AttachmentMessageBubble({ message, conversationId, botId }: Props) {
  const t = useT();
  const metadata = getDocumentMetadata(message);
  const isImage = isImageAttachmentMessage(message);
  const isAudio = isAudioAttachmentMessage(message);

  const openAttachment = useMutation({
    mutationFn: async () => {
      if (metadata?.downloadUrl) {
        window.open(metadata.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const result = await api.get<{
        url: string;
        filename: string;
      }>(
        `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.messageId)}/document?botId=${encodeURIComponent(botId)}`
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
    },
  });

  if (!metadata) {
    return <p className="emoji-text whitespace-pre-wrap break-words">{message.content}</p>;
  }

  const caption =
    message.content.trim() && message.content.trim() !== metadata.filename
      ? message.content.trim()
      : null;

  if (isAudio && metadata.downloadUrl) {
    return <ChatAudioPlayer src={metadata.downloadUrl} />;
  }

  if (isImage && metadata.downloadUrl) {
    return (
      <div className="space-y-2">
        {caption ? <p className="emoji-text whitespace-pre-wrap break-words">{caption}</p> : null}
        <button
          type="button"
          onClick={() => openAttachment.mutate()}
          disabled={openAttachment.isPending}
          className="block max-w-full overflow-hidden rounded-lg border border-default/80 bg-surface-muted/70 transition-colors hover:bg-surface-elevated"
        >
          <img
            src={metadata.downloadUrl}
            alt={metadata.filename}
            className="max-h-64 w-full object-cover"
          />
        </button>
        <p className="truncate text-xs text-secondary">{metadata.filename}</p>
      </div>
    );
  }

  const typeLabel = metadata.mimeType === "application/pdf" ? "PDF" : metadata.mimeType;

  return (
    <div className="space-y-2">
      {caption ? <p className="emoji-text whitespace-pre-wrap break-words">{caption}</p> : null}
      <button
        type="button"
        onClick={() => openAttachment.mutate()}
        disabled={openAttachment.isPending}
        className="flex w-full items-center gap-3 rounded-lg border border-default/80 bg-surface-muted/70 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated"
      >
        <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-primary">{metadata.filename}</span>
          <span className="mt-0.5 block text-xs text-secondary">{typeLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
          {t("conversations.documentView")}
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}
