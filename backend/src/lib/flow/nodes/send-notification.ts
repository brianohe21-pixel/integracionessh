import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import { sendEmail } from "../../email/client.js";
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

  const message =
    resolveBindingValue(node.data.notificationMessageBinding, bindingContext) ||
    resolveLocalizedText(
      node.data.notificationMessageText,
      getBotLocale({}, ctx.bot)
    );
  if (!message) throw new Error("Notification message is required");

  if (channel === "email") {
    const tenantFrom = await resolveTenantOutboundFrom(ctx.tenantId);
    if (tenantFrom) {
      const subject =
        node.data.notificationEmailSubject?.trim() || "Notification";
      await sendEmail({
        to: [recipient.trim().toLowerCase()],
        subject,
        text: message,
        from: tenantFrom,
      });
      return {
        nextNodeId: getNextNodeId(ctx.flow, node.id),
        halt: false,
        wait: false,
        output: recipient,
      };
    }
  }

  if (!ctx.botId || !ctx.bot) {
    throw new Error(
      channel === "email"
        ? "Configure tenant email settings with a verified domain, or add an assign bot node"
        : "Add an assign bot node before sending notifications"
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

  const participantId =
    channel === "email" ? recipient.trim().toLowerCase() : normalizePhone(recipient);
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
