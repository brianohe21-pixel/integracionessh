import { getAdvisor } from "../dynamodb/advisor.repository.js";
import { updateConversation } from "../dynamodb/conversation.repository.js";
import { sendTextMessage, truncateWhatsAppText } from "../whatsapp/client.js";
import { buildWaMeLink } from "./wa-link.js";
import type { Conversation } from "../../types/index.js";

const NOTIFY_COOLDOWN_MS = 8 * 60 * 1000;

const CLIENT_HANDOFF_MESSAGE =
  "A human advisor will assist you shortly. You can keep writing in this chat.";

export function getClientHandoffMessage(): string {
  return CLIENT_HANDOFF_MESSAGE;
}

export async function notifyAdvisorOfConversation(params: {
  tenantId: string;
  botId: string;
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  lastMessagePreview: string;
  force?: boolean;
}): Promise<void> {
  const { conversation, tenantId, botId } = params;
  if (!conversation.assignedAdvisorId) return;

  const advisor = await getAdvisor(tenantId, conversation.assignedAdvisorId);
  if (!advisor || advisor.status !== "active") return;

  const now = Date.now();
  if (!params.force && conversation.lastAdvisorNotifiedAt) {
    const elapsed = now - new Date(conversation.lastAdvisorNotifiedAt).getTime();
    if (elapsed < NOTIFY_COOLDOWN_MS) return;
  }

  const contactLabel = conversation.contactName ?? conversation.phoneNumber;
  const waLink = buildWaMeLink(
    conversation.phoneNumber,
    `Hi ${contactLabel}, I'm following up on your request.`
  );

  const body = truncateWhatsAppText(
    [
      `New message from ${contactLabel}`,
      `Phone: ${conversation.phoneNumber}`,
      `Last message: ${params.lastMessagePreview.slice(0, 200)}`,
      `Open chat: ${waLink}`,
      "You can also reply from the conversations panel.",
    ].join("\n")
  );

  await sendTextMessage({
    phoneNumberId: params.phoneNumberId,
    to: advisor.phoneNumber.replace(/\D/g, ""),
    text: body,
    accessToken: params.accessToken,
  });

  await updateConversation(tenantId, botId, conversation.conversationId, {
    lastAdvisorNotifiedAt: new Date(now).toISOString(),
  });
}
