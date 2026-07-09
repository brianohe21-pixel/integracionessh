import type { InboundNormalized, InstagramMessage } from "../../types/index.js";

export function isProcessableInstagramMessage(message: InstagramMessage): boolean {
  if (message.text) return true;
  if (message.attachments?.length) {
    return message.attachments.some((a) => a.type === "image" && a.payload?.url);
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

  const image = message.attachments?.find((a) => a.type === "image");
  if (image?.payload?.url) {
    return {
      text: `[image] ${image.payload.url}`,
      messageType: "image",
      raw: message,
    };
  }

  return { text: "", messageType: "text", raw: message };
}
