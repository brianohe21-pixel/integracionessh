import type { EmailInboundPayload, InboundNormalized } from "../../types/index.js";
import { simpleParser } from "mailparser";
import { buildEmailInboundPayload, messageHashFromId } from "./mime.js";

export function isProcessableEmailMessage(payload: EmailInboundPayload): boolean {
  return Boolean(
    payload.from &&
      (payload.text?.trim() || payload.html || payload.htmlS3Key || payload.attachments?.length)
  );
}

export function normalizeEmailMessage(payload: EmailInboundPayload): InboundNormalized {
  return {
    text: payload.text,
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

export async function parseSesInboundNotification(
  snsMessage: string,
  options?: { tenantId: string; botId: string }
): Promise<EmailInboundPayload | null> {
  try {
    const notification = JSON.parse(snsMessage) as SesSnsNotification;
    const content = notification.content ?? "";
    if (!content) return null;

    const decoded = tryBase64Decode(content);
    const parsed = await simpleParser(decoded);
    if (options) {
      const messageId = (
        parsed.messageId ??
        notification.mail?.commonHeaders?.messageId ??
        `email-${Date.now()}`
      ).replace(/^<|>$/g, "");
      return buildEmailInboundPayload(parsed, decoded, {
        tenantId: options.tenantId,
        botId: options.botId,
        messageHash: messageHashFromId(messageId),
        storeRawMime: true,
      });
    }

    const headers = notification.mail?.commonHeaders;
    const from = extractEmailAddress(headers?.from?.[0] ?? notification.mail?.source ?? "");
    const to = extractEmailAddress(headers?.to?.[0] ?? notification.mail?.destination?.[0] ?? "");
    const subject = headers?.subject ?? parsed.subject ?? "";
    const messageId = (
      headers?.messageId ??
      notification.mail?.messageId ??
      `email-${Date.now()}`
    ).replace(/^<|>$/g, "");

    if (!from || !to) return null;

    const text =
      parsed.text?.trim() ||
      (typeof parsed.html === "string" ? parsed.html.replace(/<[^>]+>/g, " ").trim() : "");
    if (!text.trim()) return null;

    return { from, to, subject, text, messageId };
  } catch {
    return null;
  }
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

function tryBase64Decode(content: string): Buffer {
  try {
    return Buffer.from(content, "base64");
  } catch {
    return Buffer.from(content);
  }
}
