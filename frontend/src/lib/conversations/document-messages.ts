import type { DocumentMessageMetadata, Message } from "@/types";

export function isDocumentMessageMetadata(
  metadata: Message["metadata"]
): metadata is DocumentMessageMetadata {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      metadata.kind === "document" &&
      typeof metadata.filename === "string"
  );
}

export function isDocumentMessage(message: Message): boolean {
  if (message.messageType === "document" && isDocumentMessageMetadata(message.metadata)) {
    return true;
  }
  return /^\[Documento\]\s*.+\.pdf$/i.test(message.content.trim());
}

export function getDocumentMetadata(message: Message): DocumentMessageMetadata | null {
  if (isDocumentMessageMetadata(message.metadata)) {
    return message.metadata;
  }

  const legacyMatch = message.content.trim().match(/^\[Documento\]\s*(.+\.pdf)$/i);
  if (!legacyMatch?.[1]) return null;

  return {
    kind: "document",
    filename: legacyMatch[1],
    mimeType: "application/pdf",
    s3Key: "",
  };
}
