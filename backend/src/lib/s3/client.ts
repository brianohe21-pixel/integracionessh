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
