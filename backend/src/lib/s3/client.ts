import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const BUCKET = process.env.MEDIA_BUCKET ?? "";

export function buildKnowledgeS3Key(
  tenantId: string,
  botId: string,
  docId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${tenantId}/bots/${botId}/docs/${docId}/${safeName}`;
}

export function buildCatalogImageS3Key(
  tenantId: string,
  botId: string,
  productId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${tenantId}/bots/${botId}/catalog/${productId}/${safeName}`;
}

export function buildQuotationPdfS3Key(
  tenantId: string,
  botId: string,
  quotationId: string
): string {
  return `tenants/${tenantId}/bots/${botId}/quotations/${quotationId}.pdf`;
}

export function buildVoiceRecordingS3Key(
  tenantId: string,
  botId: string,
  callId: string
): string {
  return `tenants/${tenantId}/voice-recordings/${botId}/${callId}.mp3`;
}

export function buildEmailRawMimeS3Key(
  tenantId: string,
  botId: string,
  messageHash: string
): string {
  return `tenants/${tenantId}/bots/${botId}/email/${messageHash}/raw.eml`;
}

export function buildEmailHtmlS3Key(
  tenantId: string,
  botId: string,
  messageHash: string
): string {
  return `tenants/${tenantId}/bots/${botId}/email/${messageHash}/body.html`;
}

export function buildEmailAttachmentS3Key(
  tenantId: string,
  botId: string,
  messageHash: string,
  attachmentId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${tenantId}/bots/${botId}/email/${messageHash}/attachments/${attachmentId}/${safeName}`;
}

export function buildConversationAttachmentS3Key(
  tenantId: string,
  botId: string,
  conversationId: string,
  attachmentId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${tenantId}/bots/${botId}/conversations/${conversationId}/attachments/${attachmentId}/${safeName}`;
}

export function buildMemberProfilePhotoS3Key(
  tenantId: string,
  userId: string,
  extension: string
): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `members/${tenantId}/${safeUserId}/profile.${safeExt}`;
}

export async function putObjectBuffer(
  s3Key: string,
  buffer: Uint8Array,
  mimeType: string
): Promise<void> {
  if (!BUCKET) throw new Error("MEDIA_BUCKET not configured");
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

export async function getObjectBuffer(s3Key: string): Promise<Uint8Array> {
  if (!BUCKET) throw new Error("MEDIA_BUCKET not configured");
  const result = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key })
  );
  const body = await result.Body?.transformToByteArray();
  if (!body) throw new Error("Empty S3 object");
  return body;
}

export async function getPresignedUploadUrl(
  s3Key: string,
  mimeType: string,
  expiresIn = 900
): Promise<string> {
  if (!BUCKET) throw new Error("MEDIA_BUCKET not configured");
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: mimeType,
    }),
    { expiresIn }
  );
}

export async function getObjectText(s3Key: string): Promise<string> {
  if (!BUCKET) throw new Error("MEDIA_BUCKET not configured");
  const result = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key })
  );
  const body = await result.Body?.transformToString("utf-8");
  if (body === undefined) throw new Error("Empty S3 object");
  return body;
}

export async function deleteObject(s3Key: string): Promise<void> {
  if (!BUCKET) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}

export async function getPresignedReadUrl(
  s3Key: string,
  expiresIn = 86400
): Promise<string> {
  if (!BUCKET) throw new Error("MEDIA_BUCKET not configured");
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn }
  );
}
