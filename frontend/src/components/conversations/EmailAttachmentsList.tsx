"use client";

import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Paperclip } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { EmailMessageAttachment } from "@/types";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailAttachmentsList({
  conversationId,
  botId,
  messageId,
  attachments,
}: {
  conversationId: string;
  botId: string;
  messageId: string;
  attachments: EmailMessageAttachment[];
}) {
  const t = useT();
  const download = useMutation({
    mutationFn: async (attachmentId: string) => {
      const result = await api.get<{
        url: string;
        filename: string;
      }>(
        `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}?botId=${encodeURIComponent(botId)}`
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
      return result;
    },
  });

  if (!attachments.length) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-default pt-3">
      <p className="text-xs font-medium text-secondary">{t("emailChannel.attachments")}</p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <button
            key={attachment.attachmentId}
            type="button"
            onClick={() => download.mutate(attachment.attachmentId)}
            disabled={download.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface-muted px-3 py-2 text-xs hover:bg-surface-elevated"
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span>{attachment.filename}</span>
            <span className="text-muted">({formatBytes(attachment.sizeBytes)})</span>
            <ExternalLink className="h-3 w-3 text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
