import { randomUUID } from "crypto";
import { normalizeConversationAttachmentMimeType } from "../conversations/attachment-policy.js";
import {
  buildConversationAttachmentS3Key,
  putObjectBuffer,
} from "../s3/client.js";
import type { DocumentMessageMetadata, WhatsAppMessage } from "../../types/index.js";
import { downloadWhatsAppMedia } from "./client.js";

function extensionForMimeType(mimeType: string, kind: "image" | "audio"): string {
  const mime = normalizeConversationAttachmentMimeType(mimeType);
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/aac":
      return "aac";
    case "audio/amr":
      return "amr";
    case "audio/ogg":
      return "ogg";
    default:
      return kind === "image" ? "bin" : "ogg";
  }
}

export function filenameForInboundMedia(kind: "image" | "audio", mimeType: string): string {
  const ext = extensionForMimeType(mimeType, kind);
  return kind === "image" ? `image.${ext}` : `audio.${ext}`;
}

export function resolveInboundMediaKind(
  message: WhatsAppMessage
): "image" | "audio" | null {
  if (message.type === "image" && message.image?.id) return "image";
  if (message.type === "audio" && message.audio?.id) return "audio";
  return null;
}

export async function persistInboundWhatsAppMedia(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  message: WhatsAppMessage;
  accessToken: string;
}): Promise<DocumentMessageMetadata | null> {
  const kind = resolveInboundMediaKind(params.message);
  if (!kind) return null;

  const mediaId =
    kind === "image" ? params.message.image!.id : params.message.audio!.id;
  const webhookMime =
    kind === "image"
      ? params.message.image?.mime_type
      : params.message.audio?.mime_type;

  const downloaded = await downloadWhatsAppMedia(mediaId, params.accessToken);
  const mimeType = normalizeConversationAttachmentMimeType(
    downloaded.mimeType ||
      webhookMime ||
      (kind === "image" ? "image/jpeg" : "audio/ogg")
  );
  const filename = filenameForInboundMedia(kind, mimeType);
  const attachmentId = randomUUID();
  const s3Key = buildConversationAttachmentS3Key(
    params.tenantId,
    params.botId,
    params.conversationId,
    attachmentId,
    filename
  );

  await putObjectBuffer(s3Key, downloaded.buffer, mimeType);

  return {
    kind,
    filename,
    mimeType,
    s3Key,
  };
}
