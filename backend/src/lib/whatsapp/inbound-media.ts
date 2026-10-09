import { randomUUID } from "crypto";
import { normalizeConversationAttachmentMimeType } from "../conversations/attachment-policy.js";
import {
  buildConversationAttachmentS3Key,
  getPresignedReadUrl,
  putObjectBuffer,
} from "../s3/client.js";
import type { DocumentMessageMetadata, WhatsAppMessage } from "../../types/index.js";
import { downloadWhatsAppMedia } from "./client.js";

const INBOUND_MEDIA_URL_TTL_SECONDS = 3600;

type InboundMediaKind = "image" | "audio" | "video";

function extensionForMimeType(mimeType: string, kind: InboundMediaKind): string {
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
    case "video/mp4":
      return "mp4";
    case "video/3gpp":
      return "3gp";
    default:
      if (kind === "image") return "bin";
      if (kind === "video") return "mp4";
      return "ogg";
  }
}

export function filenameForInboundMedia(kind: InboundMediaKind, mimeType: string): string {
  const ext = extensionForMimeType(mimeType, kind);
  return `${kind}.${ext}`;
}

export function resolveInboundMediaKind(
  message: WhatsAppMessage
): InboundMediaKind | null {
  if (message.type === "image" && message.image?.id) return "image";
  if (message.type === "audio" && message.audio?.id) return "audio";
  if (message.type === "video" && message.video?.id) return "video";
  return null;
}

function defaultMimeForKind(kind: InboundMediaKind): string {
  if (kind === "image") return "image/jpeg";
  if (kind === "video") return "video/mp4";
  return "audio/ogg";
}

function mediaIdForKind(message: WhatsAppMessage, kind: InboundMediaKind): string {
  if (kind === "image") return message.image!.id;
  if (kind === "video") return message.video!.id;
  return message.audio!.id;
}

function webhookMimeForKind(message: WhatsAppMessage, kind: InboundMediaKind): string | undefined {
  if (kind === "image") return message.image?.mime_type;
  if (kind === "video") return message.video?.mime_type;
  return message.audio?.mime_type;
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

  const mediaId = mediaIdForKind(params.message, kind);
  const webhookMime = webhookMimeForKind(params.message, kind);

  const downloaded = await downloadWhatsAppMedia(mediaId, params.accessToken);
  const mimeType = normalizeConversationAttachmentMimeType(
    downloaded.mimeType || webhookMime || defaultMimeForKind(kind)
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
  const downloadUrl = await getPresignedReadUrl(s3Key, INBOUND_MEDIA_URL_TTL_SECONDS);

  return {
    kind,
    filename,
    mimeType,
    s3Key,
    downloadUrl,
  };
}
