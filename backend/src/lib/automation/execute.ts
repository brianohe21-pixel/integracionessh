import { performHandoff } from "../advisor/handoff.js";
import { getContactByPhone, updateContact } from "../dynamodb/contact.repository.js";
import { updateConversation } from "../dynamodb/conversation.repository.js";
import { sendTemplateMessage } from "../whatsapp/client.js";
import { buildOutboundContext, sendChannelText } from "../channels/router.js";
import type { AutomationRule, Bot, Channel, Conversation } from "../../types/index.js";

export interface ExecuteAutomationContext {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
  replyToMessageId?: string;
  channel?: Channel;
}

export async function executeAutomation(
  rule: AutomationRule,
  ctx: ExecuteAutomationContext
): Promise<void> {
  const channel = ctx.channel ?? ctx.conversation.channel ?? "whatsapp";
  const outboundCtx = buildOutboundContext({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    bot: ctx.bot,
    conversation: ctx.conversation,
    accessToken: ctx.accessToken,
    environment: process.env.ENVIRONMENT ?? "dev",
    replyToExternalId: ctx.replyToMessageId,
  });

  switch (rule.action) {
    case "send_text": {
      if (!rule.messageText) throw new Error("messageText required for send_text");
      await sendChannelText(
        { ...outboundCtx, channel, participantId: ctx.customerPhone },
        rule.messageText
      );
      if (rule.trigger === "first_message") {
        await updateConversation(ctx.tenantId, ctx.botId, ctx.conversation.conversationId, {
          welcomeSentAt: new Date().toISOString(),
        });
      }
      break;
    }
    case "send_template": {
      if (channel !== "whatsapp") {
        console.warn("send_template automation skipped for non-WhatsApp channel");
        break;
      }
      if (!rule.templateName || !rule.templateLanguage) {
        throw new Error("templateName and templateLanguage required");
      }
      await sendTemplateMessage({
        phoneNumberId: ctx.phoneNumberId,
        to: ctx.customerPhone,
        templateName: rule.templateName,
        language: rule.templateLanguage,
        accessToken: ctx.accessToken,
        ...(rule.templateVariables
          ? {
              components: [
                {
                  type: "body",
                  parameters: Object.values(rule.templateVariables).map((text) => ({
                    type: "text" as const,
                    text,
                  })),
                },
              ],
            }
          : {}),
      });
      if (rule.trigger === "first_message") {
        await updateConversation(ctx.tenantId, ctx.botId, ctx.conversation.conversationId, {
          welcomeSentAt: new Date().toISOString(),
        });
      }
      break;
    }
    case "tag_contact": {
      if (channel !== "whatsapp") break;
      if (!rule.tags?.length) throw new Error("tags required for tag_contact");
      const existing = await getContactByPhone(ctx.tenantId, ctx.customerPhone);
      if (existing) {
        const mergedTags = [...new Set([...existing.tags, ...rule.tags])];
        await updateContact(ctx.tenantId, ctx.customerPhone, { tags: mergedTags });
      }
      break;
    }
    case "handoff": {
      await performHandoff({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        conversationId: ctx.conversation.conversationId,
        reason: "manual",
      });
      break;
    }
    default:
      throw new Error(`Unknown automation action: ${rule.action}`);
  }
}
