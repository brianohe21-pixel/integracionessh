import type { DocumentMessageMetadata, Message } from "@/types";

export function isDocumentMessageMetadata(
  metadata: Message["metadata"]
): metadata is DocumentMessageMetadata {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      (metadata.kind === "document" ||
        metadata.kind === "image" ||
        metadata.kind === "audio" ||
        metadata.kind === "video") &&
      typeof metadata.filename === "string"
  );
}

function metadataMimeType(message: Message): string {
  if (!isDocumentMessageMetadata(message.metadata)) return "";
  return message.metadata.mimeType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isImageAttachmentMessage(message: Message): boolean {
  if (message.messageType === "image") return true;
  if (!isDocumentMessageMetadata(message.metadata)) return false;
  if (message.metadata.kind === "image") return true;
  return metadataMimeType(message).startsWith("image/");
}

export function isAudioAttachmentMessage(message: Message): boolean {
  if (message.messageType === "audio") return true;
  if (!isDocumentMessageMetadata(message.metadata)) return false;
  if (message.metadata.kind === "audio") return true;
  return metadataMimeType(message).startsWith("audio/");
}

export function isVideoAttachmentMessage(message: Message): boolean {
  if (message.messageType === "video") return true;
  if (!isDocumentMessageMetadata(message.metadata)) return false;
  if (message.metadata.kind === "video") return true;
  return metadataMimeType(message).startsWith("video/");
}

export function isDocumentMessage(message: Message): boolean {
  if (isImageAttachmentMessage(message)) return true;
  if (isAudioAttachmentMessage(message)) return true;
  if (isVideoAttachmentMessage(message)) return true;
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
