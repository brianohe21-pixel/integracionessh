import { performHandoff } from "../advisor/handoff.js";
import { getContactByPhone, updateContact } from "../dynamodb/contact.repository.js";
import { updateConversation } from "../dynamodb/conversation.repository.js";
import { sendTextMessage, sendTemplateMessage } from "../whatsapp/client.js";
import type { AutomationRule, Conversation } from "../../types/index.js";

export interface ExecuteAutomationContext {
  tenantId: string;
  botId: string;
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
  replyToMessageId?: string;
}

export async function executeAutomation(
  rule: AutomationRule,
  ctx: ExecuteAutomationContext
): Promise<void> {
  switch (rule.action) {
    case "send_text": {
      if (!rule.messageText) throw new Error("messageText required for send_text");
      await sendTextMessage({
        phoneNumberId: ctx.phoneNumberId,
        to: ctx.customerPhone,
        text: rule.messageText,
        accessToken: ctx.accessToken,
        ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
      });
      if (rule.trigger === "first_message") {
        await updateConversation(ctx.tenantId, ctx.botId, ctx.conversation.conversationId, {
          welcomeSentAt: new Date().toISOString(),
        });
      }
      break;
    }
    case "send_template": {
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
