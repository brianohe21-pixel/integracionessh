import { normalizeEmailMessage } from "../email/inbound.js";
import { sendEmail } from "../email/client.js";
import { resolveTenantOutboundFrom } from "../email/tenant-email.service.js";
import type { EmailInboundPayload } from "../../types/index.js";
import type { ChannelAdapter, OutboundContext, OutboundResult } from "./types.js";

export const emailAdapter: ChannelAdapter = {
  channel: "email",

  normalizeInbound(payload: unknown) {
    return normalizeEmailMessage(payload as EmailInboundPayload);
  },

  async sendText(ctx: OutboundContext, text: string): Promise<OutboundResult> {
    let from = ctx.emailAddress ?? ctx.bot?.emailAddress;
    if (!from) {
      from = await resolveTenantOutboundFrom(ctx.tenantId) ?? undefined;
    }
    if (!from) {
      throw new Error("Email outbound requires a configured sender address");
    }
    const subject = ctx.emailSubject ?? ctx.conversation.emailSubject ?? "Re: Your message";
    const threadId = ctx.emailThreadMessageId ?? ctx.conversation.emailThreadMessageId;
    const result = await sendEmail({
      to: [ctx.participantId],
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      text,
      from,
      skipPlatformTemplate: true,
      ...(threadId
        ? { inReplyTo: threadId, references: threadId }
        : {}),
    });
    return { externalMessageId: result.messageId };
  },
};

export function isEmailPayload(payload: unknown): payload is EmailInboundPayload {
  const p = payload as EmailInboundPayload;
  return Boolean(
    p?.from &&
      p?.to &&
      p?.messageId &&
      (p?.text || p?.html || p?.htmlS3Key || p?.attachments?.length)
  );
}
