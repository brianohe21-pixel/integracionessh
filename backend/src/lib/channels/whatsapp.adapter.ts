import {
  markMessageAsRead,
  sendAudioMessage,
  sendDocumentMessage,
  sendImageMessage,
  sendTextMessage,
  truncateWhatsAppText,
  uploadWhatsAppMedia,
} from "../whatsapp/client.js";
import { normalizeInboundMessage } from "../whatsapp/inbound.js";
import { assertWhatsAppOutboundAllowed } from "../whatsapp/outbound-guard.js";
import type { WhatsAppInboundPayload, WhatsAppMessage } from "../../types/index.js";
import type {
  ChannelAdapter,
  OutboundContext,
  OutboundAudio,
  OutboundDocument,
  OutboundImage,
  OutboundResult,
} from "./types.js";

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
    await assertWhatsAppOutboundAllowed({
      tenantId: ctx.tenantId,
      phoneNumberId: ctx.phoneNumberId,
      kind: ctx.outboundKind ?? "service",
      to: ctx.participantId,
    });
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
    await assertWhatsAppOutboundAllowed({
      tenantId: ctx.tenantId,
      phoneNumberId: ctx.phoneNumberId,
      kind: ctx.outboundKind ?? "service",
      to: ctx.participantId,
    });
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

  async sendImage(ctx: OutboundContext, image: OutboundImage): Promise<OutboundResult> {
    if (!ctx.phoneNumberId || !ctx.accessToken) {
      throw new Error("WhatsApp outbound requires phoneNumberId and accessToken");
    }
    await assertWhatsAppOutboundAllowed({
      tenantId: ctx.tenantId,
      phoneNumberId: ctx.phoneNumberId,
      kind: ctx.outboundKind ?? "service",
      to: ctx.participantId,
    });
    const uploaded = await uploadWhatsAppMedia({
      phoneNumberId: ctx.phoneNumberId,
      accessToken: ctx.accessToken,
      buffer: image.buffer,
      mimeType: image.mimeType,
      filename: image.filename,
    });
    const result = await sendImageMessage({
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.participantId,
      accessToken: ctx.accessToken,
      mediaId: uploaded.id,
      ...(image.caption ? { caption: image.caption } : {}),
    });
    return { externalMessageId: result.messages?.[0]?.id };
  },

  async sendAudio(ctx: OutboundContext, audio: OutboundAudio): Promise<OutboundResult> {
    if (!ctx.phoneNumberId || !ctx.accessToken) {
      throw new Error("WhatsApp outbound requires phoneNumberId and accessToken");
    }
    await assertWhatsAppOutboundAllowed({
      tenantId: ctx.tenantId,
      phoneNumberId: ctx.phoneNumberId,
      kind: ctx.outboundKind ?? "service",
      to: ctx.participantId,
    });
    const uploaded = await uploadWhatsAppMedia({
      phoneNumberId: ctx.phoneNumberId,
      accessToken: ctx.accessToken,
      buffer: audio.buffer,
      mimeType: audio.mimeType,
      filename: audio.filename,
    });
    const sendOptions = {
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.participantId,
      accessToken: ctx.accessToken,
      mediaId: uploaded.id,
    };
    let result;
    try {
      result = await sendAudioMessage({
        ...sendOptions,
        ...(audio.voice ? { voice: true } : {}),
      });
    } catch (error) {
      if (!audio.voice) throw error;
      result = await sendAudioMessage(sendOptions);
    }
    const externalMessageId = result.messages?.[0]?.id;
    if (!externalMessageId) {
      throw new Error("WhatsApp did not return a message id for the audio");
    }
    return { externalMessageId };
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
