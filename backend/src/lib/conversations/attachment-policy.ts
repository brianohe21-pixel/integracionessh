export const CONVERSATION_ATTACHMENT_MAX_BYTES = 16 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/amr",
  "audio/ogg",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".js",
  ".jar",
  ".sh",
  ".php",
  ".html",
  ".htm",
]);

export function isAllowedConversationAttachmentMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.trim().toLowerCase());
}

export function isAllowedConversationAttachmentFilename(filename: string): boolean {
  const trimmed = filename.trim();
  if (!trimmed || trimmed.length > 200) return false;
  const lower = trimmed.toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lower.endsWith(ext)) return false;
  }
  if (lower.endsWith(".pdf")) return true;
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return true;
  if (lower.endsWith(".png")) return true;
  if (lower.endsWith(".webp")) return true;
  if (lower.endsWith(".mp3")) return true;
  if (lower.endsWith(".m4a")) return true;
  if (lower.endsWith(".aac")) return true;
  if (lower.endsWith(".amr")) return true;
  if (lower.endsWith(".ogg")) return true;
  if (lower.endsWith(".opus")) return true;
  return false;
}

export function inferConversationAttachmentMimeType(
  filename: string,
  mimeType: string
): string | null {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (isAllowedConversationAttachmentMimeType(normalizedMime)) {
    return normalizedMime;
  }

  const lower = filename.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".amr")) return "audio/amr";
  if (lower.endsWith(".ogg") || lower.endsWith(".opus")) return "audio/ogg";
  return null;
}

export function isImageAttachmentMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isAudioAttachmentMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return normalized.startsWith("audio/") && isAllowedConversationAttachmentMimeType(normalized);
}

export function isVoiceNoteMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return normalized === "audio/ogg" || normalized === "audio/ogg; codecs=opus";
}
