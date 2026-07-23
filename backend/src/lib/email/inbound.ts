import type { EmailInboundPayload, InboundNormalized } from "../../types/index.js";

export function isProcessableEmailMessage(payload: EmailInboundPayload): boolean {
  return Boolean(payload.from && payload.text?.trim());
}

export function normalizeEmailMessage(payload: EmailInboundPayload): InboundNormalized {
  const subjectPrefix = payload.subject ? `[${payload.subject}] ` : "";
  return {
    text: `${subjectPrefix}${payload.text}`,
    messageType: "text",
    raw: payload,
  };
}

export interface SesSnsNotification {
  notificationType?: string;
  mail?: {
    messageId?: string;
    source?: string;
    destination?: string[];
    commonHeaders?: {
      from?: string[];
      to?: string[];
      subject?: string;
      messageId?: string;
    };
  };
  content?: string;
}

export function parseSesInboundNotification(
  snsMessage: string
): EmailInboundPayload | null {
  try {
    const notification = JSON.parse(snsMessage) as SesSnsNotification;
    const headers = notification.mail?.commonHeaders;
    const from = extractEmailAddress(headers?.from?.[0] ?? notification.mail?.source ?? "");
    const to = extractEmailAddress(headers?.to?.[0] ?? notification.mail?.destination?.[0] ?? "");
    const subject = headers?.subject ?? "";
    const messageId = headers?.messageId ?? notification.mail?.messageId ?? `email-${Date.now()}`;

    if (!from || !to) return null;

    const text = extractPlainTextFromMime(notification.content ?? "");
    if (!text.trim()) return null;

    return { from, to, subject, text: text.trim(), messageId };
  } catch {
    return null;
  }
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

function extractPlainTextFromMime(content: string): string {
  if (!content) return "";
  const decoded = tryBase64Decode(content);
  const textPart = decoded.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|$)/i);
  if (textPart?.[1]) return decodeQuotedPrintable(textPart[1].trim());
  const stripped = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped;
}

function tryBase64Decode(content: string): string {
  try {
    return Buffer.from(content, "base64").toString("utf-8");
  } catch {
    return content;
  }
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
