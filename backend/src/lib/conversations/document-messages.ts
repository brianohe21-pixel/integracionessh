import type { DocumentMessageMetadata, Message, Quotation } from "../../types/index.js";
import { findConversationMessage } from "../email/attachments.js";
import { listQuotationsForConversation } from "../dynamodb/quotation.repository.js";
import { getPresignedReadUrl } from "../s3/client.js";

const DOCUMENT_URL_TTL_SECONDS = 3600;

export function isDocumentMessageMetadata(
  metadata: unknown
): metadata is DocumentMessageMetadata {
  if (!metadata || typeof metadata !== "object") return false;
  const value = metadata as Record<string, unknown>;
  return (
    (value.kind === "document" || value.kind === "image") &&
    typeof value.s3Key === "string"
  );
}

export function parseLegacyDocumentFilename(content: string): string | null {
  const match = content.trim().match(/^\[Documento\]\s*(.+\.pdf)$/i);
  return match?.[1] ?? null;
}

function buildDocumentMetadata(params: {
  filename: string;
  mimeType: string;
  s3Key: string;
  quotationId?: string;
  downloadUrl: string;
}): DocumentMessageMetadata {
  return {
    kind: "document",
    filename: params.filename,
    mimeType: params.mimeType,
    s3Key: params.s3Key,
    downloadUrl: params.downloadUrl,
    ...(params.quotationId ? { quotationId: params.quotationId } : {}),
  };
}

async function presignDocumentMetadata(
  metadata: DocumentMessageMetadata
): Promise<DocumentMessageMetadata> {
  const downloadUrl = await getPresignedReadUrl(metadata.s3Key, DOCUMENT_URL_TTL_SECONDS);
  return { ...metadata, downloadUrl };
}

function findQuotationForFilename(
  quotations: Quotation[],
  filename: string
): Quotation | undefined {
  return quotations.find((quotation) => `${quotation.number}.pdf` === filename);
}

async function loadQuotationsByConversation(
  tenantId: string,
  botId: string,
  conversationIds: string[]
): Promise<Map<string, Quotation[]>> {
  const map = new Map<string, Quotation[]>();
  await Promise.all(
    conversationIds.map(async (conversationId) => {
      const quotations = await listQuotationsForConversation({
        tenantId,
        botId,
        conversationId,
      });
      map.set(conversationId, quotations);
    })
  );
  return map;
}

export async function enrichConversationMessages(
  messages: Message[],
  context: { tenantId: string; botId: string }
): Promise<Message[]> {
  const legacyConversationIds = new Set<string>();

  for (const message of messages) {
    if (isDocumentMessageMetadata(message.metadata)) continue;
    if (!parseLegacyDocumentFilename(message.content)) continue;
    legacyConversationIds.add(message.conversationId);
  }

  const quotationsByConversation =
    legacyConversationIds.size > 0
      ? await loadQuotationsByConversation(
          context.tenantId,
          context.botId,
          [...legacyConversationIds]
        )
      : new Map<string, Quotation[]>();

  return Promise.all(
    messages.map(async (message) => {
      if (isDocumentMessageMetadata(message.metadata)) {
        const messageType =
          message.metadata.kind === "image" ? "image" : "document";
        return {
          ...message,
          messageType,
          metadata: (await presignDocumentMetadata(
            message.metadata
          )) as unknown as Record<string, unknown>,
        };
      }

      const legacyFilename = parseLegacyDocumentFilename(message.content);
      if (!legacyFilename) return message;

      const quotations = quotationsByConversation.get(message.conversationId) ?? [];
      const quotation = findQuotationForFilename(quotations, legacyFilename);
      if (!quotation?.pdfS3Key) return message;

      const downloadUrl = await getPresignedReadUrl(quotation.pdfS3Key, DOCUMENT_URL_TTL_SECONDS);
      return {
        ...message,
        messageType: "document",
        metadata: buildDocumentMetadata({
          filename: legacyFilename,
          mimeType: "application/pdf",
          s3Key: quotation.pdfS3Key,
          quotationId: quotation.quotationId,
          downloadUrl,
        }) as unknown as Record<string, unknown>,
      };
    })
  );
}

export async function resolveDocumentDownloadUrl(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  messageId: string;
}): Promise<{
  url: string;
  expiresInSeconds: number;
  filename: string;
  mimeType: string;
} | null> {
  const message = await findConversationMessage(
    params.tenantId,
    params.conversationId,
    params.messageId
  );
  if (!message) return null;

  if (isDocumentMessageMetadata(message.metadata)) {
    const url = await getPresignedReadUrl(
      message.metadata.s3Key,
      DOCUMENT_URL_TTL_SECONDS
    );
    return {
      url,
      expiresInSeconds: DOCUMENT_URL_TTL_SECONDS,
      filename: message.metadata.filename,
      mimeType: message.metadata.mimeType,
    };
  }

  const legacyFilename = parseLegacyDocumentFilename(message.content);
  if (!legacyFilename) return null;

  const quotations = await listQuotationsForConversation({
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
  });
  const quotation = findQuotationForFilename(quotations, legacyFilename);
  if (!quotation?.pdfS3Key) return null;

  const url = await getPresignedReadUrl(quotation.pdfS3Key, DOCUMENT_URL_TTL_SECONDS);
  return {
    url,
    expiresInSeconds: DOCUMENT_URL_TTL_SECONDS,
    filename: legacyFilename,
    mimeType: "application/pdf",
  };
}
