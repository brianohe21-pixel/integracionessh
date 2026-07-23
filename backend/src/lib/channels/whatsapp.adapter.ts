import {
  markMessageAsRead,
  sendDocumentMessage,
  sendTextMessage,
  truncateWhatsAppText,
  uploadWhatsAppMedia,
} from "../whatsapp/client.js";
import { normalizeInboundMessage } from "../whatsapp/inbound.js";
import type { WhatsAppInboundPayload, WhatsAppMessage } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundDocument, OutboundResult } from "./types.js";

export const whatsappAdapter: ChannelAdapter = {
  channel: "whatsapp",

  normalizeInbound(payload: unknown) {
    const wa = payload as WhatsAppInboundPayload;
    return normalizeInboundMessage(wa.message);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    if (!ctx.phoneNumberId || !ctx.accessToken) {
      throw new Error("WhatsApp outbound requires phoneNumberId and accessToken");
    }
    const outboundText = truncateWhatsAppText(text);
    const result = await sendTextMessage({
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.participantId,
      text: outboundText,
      accessToken: ctx.accessToken,
      ...(ctx.replyToExternalId ? { replyToMessageId: ctx.replyToExternalId } : {}),
    });
    return { externalMessageId: result.messages?.[0]?.id };
  },

  async sendDocument(ctx: OutboundContext, doc: OutboundDocument): Promise<OutboundResult> {
    if (!ctx.phoneNumberId || !ctx.accessToken) {
      throw new Error("WhatsApp outbound requires phoneNumberId and accessToken");
    }
    const uploaded = await uploadWhatsAppMedia({
      phoneNumberId: ctx.phoneNumberId,
      accessToken: ctx.accessToken,
      buffer: doc.buffer,
      mimeType: doc.mimeType,
      filename: doc.filename,
    });
    const result = await sendDocumentMessage({
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.participantId,
      accessToken: ctx.accessToken,
      mediaId: uploaded.id,
      filename: doc.filename,
      ...(doc.caption ? { caption: doc.caption } : {}),
    });
    return { externalMessageId: result.messages?.[0]?.id };
  },

  async markRead(ctx: OutboundContext, externalMessageId: string): Promise<void> {
    if (!ctx.phoneNumberId || !ctx.accessToken) return;
    await markMessageAsRead(ctx.phoneNumberId, externalMessageId, ctx.accessToken).catch(() => {});
  },
};

export function isWhatsAppPayload(payload: unknown): payload is WhatsAppInboundPayload {
  const p = payload as WhatsAppInboundPayload;
  return Boolean(p?.message && (p.message as WhatsAppMessage).from);
}
