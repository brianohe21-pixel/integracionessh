import { createHash, randomUUID } from "crypto";
import { simpleParser, type Attachment, type ParsedMail } from "mailparser";
import type { EmailAttachmentRef, EmailInboundPayload } from "../../types/index.js";
import { sanitizeEmailHtml, stripHtmlToText } from "./sanitize.js";
import {
  buildEmailAttachmentS3Key,
  buildEmailHtmlS3Key,
  buildEmailRawMimeS3Key,
  putObjectBuffer,
} from "../s3/client.js";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const MAX_HTML_BYTES = 512 * 1024;
const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".js",
  ".vbs",
  ".ps1",
]);

export interface ParseEmailMimeOptions {
  tenantId: string;
  botId: string;
  messageHash: string;
  storeRawMime?: boolean;
}

function messageHashFromId(messageId: string): string {
  return createHash("sha256").update(messageId).digest("hex").slice(0, 24);
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

function extractDisplayName(raw: string): string | undefined {
  const match = raw.match(/^(.+?)\s*<[^>]+>$/);
  const name = match?.[1]?.replace(/^["']|["']$/g, "").trim();
  return name || undefined;
}

function isBlockedAttachment(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase();
  for (const ext of BLOCKED_ATTACHMENT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  if (mimeType === "application/javascript" || mimeType === "text/javascript") return true;
  return false;
}

async function uploadAttachments(
  tenantId: string,
  botId: string,
  messageHash: string,
  attachments: Attachment[]
): Promise<EmailAttachmentRef[]> {
  const refs: EmailAttachmentRef[] = [];
  let count = 0;

  for (const attachment of attachments) {
    if (count >= MAX_ATTACHMENTS) break;
    const content = attachment.content;
    if (!content || content.length === 0) continue;
    if (content.length > MAX_ATTACHMENT_BYTES) continue;

    const filename = attachment.filename || `attachment-${count + 1}`;
    const mimeType = attachment.contentType || "application/octet-stream";
    if (isBlockedAttachment(filename, mimeType)) continue;

    const attachmentId = randomUUID();
    const s3Key = buildEmailAttachmentS3Key(tenantId, botId, messageHash, attachmentId, filename);
    await putObjectBuffer(s3Key, content, mimeType);

    refs.push({
      attachmentId,
      filename,
      mimeType,
      sizeBytes: content.length,
      s3Key,
      ...(attachment.contentId ? { contentId: attachment.contentId.replace(/^<|>$/g, "") } : {}),
      disposition: attachment.contentDisposition === "inline" ? "inline" : "attachment",
    });
    count += 1;
  }

  return refs;
}

export async function parseEmailMime(
  rawMime: Buffer | string,
  options: ParseEmailMimeOptions
): Promise<EmailInboundPayload | null> {
  const parsed = await simpleParser(rawMime);
  return buildEmailInboundPayload(parsed, rawMime, options);
}

export async function buildEmailInboundPayload(
  parsed: ParsedMail,
  rawMime: Buffer | string,
  options: ParseEmailMimeOptions
): Promise<EmailInboundPayload | null> {
  const fromRaw = parsed.from?.value?.[0];
  const toRaw = parsed.to
    ? Array.isArray(parsed.to)
      ? parsed.to[0]?.value?.[0]
      : parsed.to.value?.[0]
    : undefined;

  const from = extractEmailAddress(fromRaw?.address ?? "");
  const to = extractEmailAddress(toRaw?.address ?? "");
  if (!from || !to) return null;

  const subject = parsed.subject ?? "";
  const messageId = (parsed.messageId ?? `generated-${randomUUID()}`).replace(/^<|>$/g, "");
  const messageHash = options.messageHash || messageHashFromId(messageId);

  const textFromPlain = parsed.text?.trim() ?? "";
  const htmlRaw = typeof parsed.html === "string" ? parsed.html : "";
  const textFromHtml = htmlRaw ? stripHtmlToText(htmlRaw) : "";
  const text = textFromPlain || textFromHtml;

  const attachmentRefs = await uploadAttachments(
    options.tenantId,
    options.botId,
    messageHash,
    parsed.attachments ?? []
  );

  let htmlS3Key: string | undefined;
  let sanitizedHtml: string | undefined;
  if (htmlRaw) {
    sanitizedHtml = sanitizeEmailHtml(htmlRaw);
    if (Buffer.byteLength(sanitizedHtml, "utf8") > MAX_HTML_BYTES) {
      htmlS3Key = buildEmailHtmlS3Key(options.tenantId, options.botId, messageHash);
      await putObjectBuffer(htmlS3Key, Buffer.from(sanitizedHtml, "utf8"), "text/html; charset=utf-8");
      sanitizedHtml = undefined;
    }
  }

  let rawMimeS3Key: string | undefined;
  if (options.storeRawMime) {
    const buffer = Buffer.isBuffer(rawMime) ? rawMime : Buffer.from(rawMime);
    rawMimeS3Key = buildEmailRawMimeS3Key(options.tenantId, options.botId, messageHash);
    await putObjectBuffer(rawMimeS3Key, buffer, "message/rfc822");
  }

  if (!text.trim() && attachmentRefs.length === 0 && !sanitizedHtml && !htmlS3Key) {
    return null;
  }

  const cc = parsed.cc
    ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc])
        .flatMap((entry) => entry.value?.map((v) => extractEmailAddress(v.address ?? "")) ?? [])
        .filter(Boolean)
    : undefined;

  const fromName = fromRaw?.name || extractDisplayName(parsed.from?.text ?? "");
  const references = parsed.references
    ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]).map((ref) =>
        ref.replace(/^<|>$/g, "")
      )
    : [];

  return {
    from,
    ...(fromName ? { fromName } : {}),
    to,
    ...(cc?.length ? { cc } : {}),
    subject,
    text: text || subject || "(no content)",
    ...(sanitizedHtml ? { html: sanitizedHtml } : {}),
    messageId,
    ...(parsed.inReplyTo ? { inReplyTo: parsed.inReplyTo.replace(/^<|>$/g, "") } : {}),
    ...(references.length ? { references } : {}),
    ...(attachmentRefs.length ? { attachments: attachmentRefs } : {}),
    ...(rawMimeS3Key ? { rawMimeS3Key } : {}),
    ...(htmlS3Key ? { htmlS3Key } : {}),
  };
}

export function buildEmailMessageMetadata(payload: EmailInboundPayload) {
  return {
    kind: "email" as const,
    subject: payload.subject,
    from: payload.from,
    ...(payload.fromName ? { fromName: payload.fromName } : {}),
    to: payload.to,
    ...(payload.cc?.length ? { cc: payload.cc } : {}),
    textBody: payload.text,
    ...(payload.html ? { htmlBody: payload.html } : {}),
    ...(payload.htmlS3Key ? { htmlS3Key: payload.htmlS3Key } : {}),
    hasAttachments: Boolean(payload.attachments?.length),
    attachmentCount: payload.attachments?.length ?? 0,
    ...(payload.attachments?.length
      ? {
          attachments: payload.attachments.map((attachment) => ({
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            disposition: attachment.disposition,
            ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
          })),
        }
      : {}),
    ...(payload.inReplyTo ? { inReplyTo: payload.inReplyTo } : {}),
    messageId: payload.messageId,
  };
}

export { messageHashFromId };
