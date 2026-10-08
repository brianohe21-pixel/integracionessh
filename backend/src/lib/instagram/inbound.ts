import type { InboundNormalized, InstagramMessage } from "../../types/index.js";

const PROCESSABLE_ATTACHMENT_TYPES = new Set(["image", "audio", "video", "file", "share"]);

export function isProcessableInstagramMessage(message: InstagramMessage): boolean {
  if (message.is_echo) return false;
  if (message.text) return true;
  if (message.attachments?.length) {
    return message.attachments.some(
      (a) => PROCESSABLE_ATTACHMENT_TYPES.has(a.type) && Boolean(a.payload?.url || a.type === "share")
    );
  }
  return false;
}

export function normalizeInstagramMessage(message: InstagramMessage): InboundNormalized {
  if (message.text) {
    return {
      text: message.text,
      messageType: "text",
      raw: message,
    };
  }

  const attachment = message.attachments?.find((a) => PROCESSABLE_ATTACHMENT_TYPES.has(a.type));
  if (attachment) {
    const url = attachment.payload?.url;
    const label = attachment.type;
    return {
      text: url ? `[${label}] ${url}` : `[${label}]`,
      messageType: attachment.type === "image" ? "image" : "text",
      raw: message,
    };
  }

  return { text: "", messageType: "text", raw: message };
}
