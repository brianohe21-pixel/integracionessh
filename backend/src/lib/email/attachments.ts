import type { EmailMessageMetadata } from "../../types/index.js";
import { getConversationMessages } from "../dynamodb/conversation.repository.js";
import { buildEmailAttachmentS3Key, getObjectText, getPresignedReadUrl } from "../s3/client.js";
import { messageHashFromId } from "./mime.js";

export function isEmailMessageMetadata(
  metadata: Record<string, unknown> | undefined
): metadata is EmailMessageMetadata & Record<string, unknown> {
  return metadata?.kind === "email";
}

export async function findConversationMessage(
  tenantId: string,
  conversationId: string,
  messageId: string
) {
  const messages = await getConversationMessages(tenantId, conversationId, 100);
  return messages.find((message) => message.messageId === messageId) ?? null;
}

function attachmentS3Key(
  tenantId: string,
  botId: string,
  messageId: string,
  attachmentId: string,
  filename: string
): string {
  return buildEmailAttachmentS3Key(
    tenantId,
    botId,
    messageHashFromId(messageId),
    attachmentId,
    filename
  );
}

export async function resolveEmailAttachmentUrl(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  messageId: string;
  attachmentId: string;
}): Promise<{
  url: string;
  expiresInSeconds: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
} | null> {
  const message = await findConversationMessage(params.tenantId, params.conversationId, params.messageId);
  if (!message?.metadata || !isEmailMessageMetadata(message.metadata)) return null;

  const attachment = message.metadata.attachments?.find(
    (item) => item.attachmentId === params.attachmentId
  );
  if (!attachment) return null;

  const s3Key = attachmentS3Key(
    params.tenantId,
    params.botId,
    message.metadata.messageId,
    attachment.attachmentId,
    attachment.filename
  );
  const url = await getPresignedReadUrl(s3Key, 900);
  return {
    url,
    expiresInSeconds: 900,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
  };
}

export async function resolveEmailHtmlBody(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  messageId: string;
}): Promise<{ html: string } | null> {
  const message = await findConversationMessage(params.tenantId, params.conversationId, params.messageId);
  if (!message?.metadata || !isEmailMessageMetadata(message.metadata)) return null;

  let html = message.metadata.htmlBody ?? "";
  if (!html && message.metadata.htmlS3Key) {
    html = await getObjectText(message.metadata.htmlS3Key);
  }
  if (!html) return null;

  for (const attachment of message.metadata.attachments ?? []) {
    if (attachment.disposition !== "inline" || !attachment.contentId) continue;
    const s3Key = attachmentS3Key(
      params.tenantId,
      params.botId,
      message.metadata.messageId,
      attachment.attachmentId,
      attachment.filename
    );
    const url = await getPresignedReadUrl(s3Key, 900);
    html = html.replace(new RegExp(`cid:${attachment.contentId}`, "gi"), url);
  }

  return { html };
}
