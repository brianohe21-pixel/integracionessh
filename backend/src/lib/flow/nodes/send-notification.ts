import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import { sendEmail } from "../../email/client.js";
import { sanitizeEmailHtml, stripHtmlToText } from "../../email/sanitize.js";
import { sendTemplateMessage } from "../../whatsapp/client.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { getBotLocale, resolveLocalizedText } from "../../i18n/index.js";
import { normalizePhone } from "../../dynamodb/contact.repository.js";
import { getContactByPhone } from "../../dynamodb/contact.repository.js";
import { resolveTenantOutboundFrom } from "../../email/tenant-email.service.js";
import type { Channel, Conversation } from "../../../types/index.js";

function buildSyntheticConversation(params: {
  tenantId: string;
  botId: string;
  channel: Channel;
  participantId: string;
}): Conversation {
  const now = new Date().toISOString();
  return {
    conversationId: `form-${params.participantId}`,
    tenantId: params.tenantId,
    botId: params.botId,
    channel: params.channel,
    participantId: params.participantId,
    phoneNumber: params.participantId,
    status: "active",
    messageCount: 0,
    lastMessageAt: now,
    createdAt: now,
  };
}

export async function executeSendNotificationNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const channel = node.data.notificationChannel ?? "whatsapp";

  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
  });

  const recipient = resolveBindingValue(
    node.data.notificationRecipientBinding,
    bindingContext
  );
  if (!recipient) throw new Error("notificationRecipientBinding is required");

  const locale = getBotLocale({}, ctx.bot);
  const messageTemplate =
    resolveLocalizedText(node.data.notificationMessageText, locale) ||
    node.data.notificationMessageBinding?.trim() ||
    "";
  const bindingMessage = resolveBindingValue(messageTemplate, bindingContext);

  if (channel === "email") {
    const htmlTemplate =
      resolveLocalizedText(node.data.notificationMessageHtml, locale) ||
      node.data.notificationMessageBinding?.trim() ||
      "";
    const htmlRaw = resolveBindingValue(htmlTemplate, bindingContext) || htmlTemplate;

    let html: string | undefined;
    let text = "";

    if (htmlRaw.trim()) {
      html = sanitizeEmailHtml(htmlRaw);
      text = stripHtmlToText(html);
    }
    if (!text && messageTemplate) {
      text = bindingMessage || messageTemplate.trim();
    }
    if (!text) throw new Error("Notification message is required");

    const tenantFrom = await resolveTenantOutboundFrom(ctx.tenantId);
    const subject = node.data.notificationEmailSubject?.trim() || "Notification";
    await sendEmail({
      to: [recipient.trim().toLowerCase()],
      subject,
      text,
      ...(html ? { html } : {}),
      ...(tenantFrom ? { from: tenantFrom } : {}),
    });
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      output: recipient,
    };
  }

  const message = bindingMessage || messageTemplate;
  if (!message) throw new Error("Notification message is required");

  if (!ctx.botId || !ctx.bot) {
    throw new Error(
      "WhatsApp and SMS notifications require an assign bot node with an agent configured"
    );
  }

  if (channel === "whatsapp" || channel === "sms") {
    const phone = normalizePhone(recipient);
    const contact = await getContactByPhone(ctx.tenantId, phone);
    if (contact?.suppressed) {
      throw new Error("Recipient is suppressed");
    }
    if (contact?.marketingConsent === "opt_out") {
      throw new Error("Recipient opted out of marketing messages");
    }
  }

  const participantId = normalizePhone(recipient);
  const conversation = buildSyntheticConversation({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    channel,
    participantId,
  });

  const outbound = buildOutboundContext({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    bot: ctx.bot,
    conversation,
    accessToken: ctx.accessToken,
    environment: ctx.environment,
  });

  if (channel === "whatsapp" && node.data.notificationTemplateName) {
    await sendTemplateMessage({
      phoneNumberId: ctx.bot.phoneNumberId,
      accessToken: ctx.accessToken ?? "",
      to: participantId,
      templateName: node.data.notificationTemplateName,
      language: node.data.notificationTemplateLanguage ?? "es",
    });
  } else {
    await sendChannelText(outbound, message);
  }

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: recipient,
  };
}
