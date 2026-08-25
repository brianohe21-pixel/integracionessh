import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import { sendEmail } from "../../email/client.js";
import { sanitizeEmailHtml, stripHtmlToText } from "../../email/sanitize.js";
import { getBot } from "../../dynamodb/bot.repository.js";
import { sendSmsFromTemplate } from "../../sms/send-outbound.js";
import { sendTemplateMessage, getWhatsAppAccessToken } from "../../whatsapp/client.js";
import type { Bot, Channel, Conversation, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { buildBindingContext, resolveBindingValue } from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { getBotLocale, resolveLocalizedText } from "../../i18n/index.js";
import { normalizePhone, getContactByPhone } from "../../dynamodb/contact.repository.js";
import { resolveTenantOutboundFrom } from "../../email/tenant-email.service.js";

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

async function resolveNotificationMessagingBot(
  node: FlowNode,
  ctx: FlowExecutionContext
): Promise<{ botId: string; bot: Bot; accessToken: string }> {
  const botId = node.data.notificationBotId?.trim() || ctx.botId;
  if (!botId) {
    throw new Error("Select a bot on the notification node");
  }

  const bot = ctx.botId === botId && ctx.bot ? ctx.bot : await getBot(ctx.tenantId, botId);
  if (!bot) throw new Error("Bot not found");

  let accessToken = ctx.botId === botId ? (ctx.accessToken ?? "") : "";
  if (!accessToken) {
    try {
      accessToken = await getWhatsAppAccessToken(ctx.tenantId, ctx.environment);
    } catch {
      accessToken = "";
    }
  }

  return { botId, bot, accessToken };
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
    const emailResult = await sendEmail({
      to: [recipient.trim().toLowerCase()],
      subject,
      text,
      ...(html ? { html } : {}),
      ...(tenantFrom ? { from: tenantFrom } : {}),
    });
    if (emailResult.messageId.startsWith("skipped-")) {
      throw new Error(
        "Email could not be sent: configure SES_FROM_EMAIL or tenant email settings with a verified domain"
      );
    }
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      output: recipient,
    };
  }

  const useTemplate =
    node.data.notificationMessageType === "template" && !!node.data.notificationTemplateName?.trim();

  const message = bindingMessage || messageTemplate;
  if (!useTemplate && !message) throw new Error("Notification message is required");

  const { botId, bot, accessToken } = await resolveNotificationMessagingBot(node, ctx);

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
    botId,
    channel,
    participantId,
  });

  const outbound = buildOutboundContext({
    tenantId: ctx.tenantId,
    botId,
    bot,
    conversation,
    accessToken,
    environment: ctx.environment,
  });

  if (useTemplate && channel === "whatsapp") {
    const templateVariables = node.data.notificationTemplateVariables ?? {};
    const parameters = Object.keys(templateVariables)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map((key) => resolveBindingValue(templateVariables[key], bindingContext));

    await sendTemplateMessage({
      phoneNumberId: bot.phoneNumberId,
      accessToken,
      to: participantId,
      templateName: node.data.notificationTemplateName!.trim(),
      language: node.data.notificationTemplateLanguage ?? "es",
      ...(parameters.length
        ? {
            components: [
              {
                type: "body",
                parameters: parameters.map((text) => ({ type: "text" as const, text })),
              },
            ],
          }
        : {}),
    });
  } else if (useTemplate && channel === "sms") {
    const templateVariables = node.data.notificationTemplateVariables ?? {};
    const parameters = Object.keys(templateVariables)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map((key) => resolveBindingValue(templateVariables[key], bindingContext));

    await sendSmsFromTemplate({
      tenantId: ctx.tenantId,
      bot,
      botId,
      templateName: node.data.notificationTemplateName!.trim(),
      language: node.data.notificationTemplateLanguage ?? "es",
      to: participantId,
      environment: ctx.environment,
      ...(parameters.length
        ? {
            components: [
              {
                type: "body",
                parameters: parameters.map((text) => ({ type: "text" as const, text })),
              },
            ],
          }
        : {}),
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
