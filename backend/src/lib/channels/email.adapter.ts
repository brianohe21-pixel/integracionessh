import { normalizeEmailMessage } from "../email/inbound.js";
import { sendEmail } from "../email/client.js";
import type { EmailInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const emailAdapter: ChannelAdapter = {
  channel: "email",

  normalizeInbound(payload: unknown) {
    return normalizeEmailMessage(payload as EmailInboundPayload);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    const from = ctx.emailAddress ?? ctx.bot.emailAddress;
    if (!from) {
      throw new Error("Email outbound requires emailAddress");
    }
    const subject = ctx.emailSubject ?? ctx.conversation.emailSubject ?? "Re: Your message";
    const threadId = ctx.emailThreadMessageId ?? ctx.conversation.emailThreadMessageId;
    const result = await sendEmail({
      to: [ctx.participantId],
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      text,
      from,
      ...(threadId
        ? { inReplyTo: threadId, references: threadId }
        : {}),
    });
    return { externalMessageId: result.messageId };
  },
};

export function isEmailPayload(payload: unknown): payload is EmailInboundPayload {
  const p = payload as EmailInboundPayload;
  return Boolean(p?.from && p?.to && p?.text && p?.messageId);
}
