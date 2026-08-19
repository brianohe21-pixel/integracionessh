"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import type { EmailMessageMetadata, Message } from "@/types";
import { EmailAttachmentsList } from "./EmailAttachmentsList";
import { EmailBodyToggle } from "./EmailHtmlBody";

function isEmailMetadata(metadata: Message["metadata"]): metadata is EmailMessageMetadata {
  return Boolean(metadata && typeof metadata === "object" && metadata.kind === "email");
}

export function EmailMessageBubble({
  message,
  botId,
}: {
  message: Message;
  botId: string;
}) {
  const t = useT();
  const metadata = isEmailMetadata(message.metadata) ? message.metadata : null;

  const { data: htmlData } = useQuery({
    queryKey: ["email-html", message.conversationId, message.messageId],
    queryFn: () =>
      api.get<{ html: string }>(
        `/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.messageId)}/html?botId=${encodeURIComponent(botId)}`
      ),
    enabled: Boolean(metadata && !metadata.htmlBody && metadata.htmlS3Key),
    staleTime: 60_000,
  });

  if (!metadata) {
    return <p className="whitespace-pre-wrap">{message.content}</p>;
  }

  const fromLabel = metadata.fromName
    ? `${metadata.fromName} <${metadata.from}>`
    : metadata.from;
  const html = metadata.htmlBody ?? htmlData?.html;

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-xs text-secondary">
        <p>
          <span className="font-medium text-primary">{t("emailChannel.from")}:</span> {fromLabel}
        </p>
        <p>
          <span className="font-medium text-primary">{t("emailChannel.to")}:</span> {metadata.to}
        </p>
        <p>
          <span className="font-medium text-primary">{t("emailChannel.subject")}:</span> {metadata.subject}
        </p>
      </div>
      <EmailBodyToggle textBody={metadata.textBody || message.content} html={html} />
      {metadata.attachments && metadata.attachments.length > 0 && (
        <EmailAttachmentsList
          conversationId={message.conversationId}
          botId={botId}
          messageId={message.messageId}
          attachments={metadata.attachments}
        />
      )}
    </div>
  );
}
