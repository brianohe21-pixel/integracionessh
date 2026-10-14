import { channelLabel } from "../process-inbound/parse.js";
import { getAdvisor } from "../dynamodb/advisor.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { updateConversation } from "../dynamodb/conversation.repository.js";
import { getWhatsAppChannelByPhoneNumberId } from "../dynamodb/whatsapp-channel.repository.js";
import { sendTextMessage, truncateWhatsAppText } from "../whatsapp/client.js";
import { isWhatsAppCoexistence } from "../whatsapp/coexistence/read-receipt.js";
import { assertWhatsAppOutboundAllowed } from "../whatsapp/outbound-guard.js";
import { isWhatsAppBsuid } from "../whatsapp/identity.js";
import { buildWaMeLink } from "./wa-link.js";
import type { Conversation } from "../../types/index.js";

export function isSameWhatsAppRecipient(
  businessDisplayPhone: string | undefined,
  advisorPhone: string | undefined
): boolean {
  const business = (businessDisplayPhone ?? "").replace(/\D/g, "");
  const advisor = (advisorPhone ?? "").replace(/\D/g, "");
  if (!business || !advisor) return false;
  return business === advisor;
}

const NOTIFY_COOLDOWN_MS = 8 * 60 * 1000;

import type { BotLocale } from "../i18n/types.js";
import { getSystemMessage } from "../i18n/messages.js";

export function getClientHandoffMessage(locale: BotLocale = "es"): string {
  return getSystemMessage("clientHandoff", locale);
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

  const businessChannel = params.phoneNumberId
    ? await getWhatsAppChannelByPhoneNumberId(params.phoneNumberId).catch((err) => {
        console.warn("Failed to load WhatsApp channel for advisor notify:", err);
        return null;
      })
    : null;
  const bot = businessChannel ? null : await getBot(tenantId, botId);
  const coexistence = businessChannel
    ? isWhatsAppCoexistence(businessChannel)
    : Boolean(
        bot &&
          (!bot.phoneNumberId || bot.phoneNumberId === params.phoneNumberId) &&
          isWhatsAppCoexistence(bot)
      );
  if (
    coexistence ||
    isSameWhatsAppRecipient(businessChannel?.displayPhoneNumber, advisor.phoneNumber)
  ) {
    console.warn(
      `Skipping advisor notify tenant=${tenantId} phoneNumberId=${params.phoneNumberId} coexistence=${coexistence}`
    );
    await updateConversation(tenantId, botId, conversation.conversationId, {
      lastAdvisorNotifiedAt: new Date(now).toISOString(),
    });
    return;
  }

  const channel = conversation.channel ?? "whatsapp";
  const participantId = conversation.participantId ?? conversation.phoneNumber;
  const contactLabel = conversation.contactName ?? participantId;
  const identity = conversation.phoneNumber || participantId;
  const identityIsBsuid = Boolean(identity && isWhatsAppBsuid(identity));

  const channelLine =
    channel === "whatsapp"
      ? identityIsBsuid
        ? `ID de usuario: ${identity}`
        : `Teléfono: ${identity}`
      : `Canal: ${channelLabel(channel)} · ID: ${participantId}`;

  const waLink =
    channel === "whatsapp" && identity && !identityIsBsuid
      ? buildWaMeLink(
          identity,
          `Hola ${contactLabel}, te escribo respecto a tu solicitud.`
        )
      : null;
  const waLinkLine = waLink
    ? `Abrir chat: ${waLink}`
    : "Responde desde el panel de conversaciones.";

  const body = truncateWhatsAppText(
    [
      `Nuevo mensaje de ${contactLabel}`,
      channelLine,
      `Último mensaje: ${params.lastMessagePreview.slice(0, 200)}`,
      waLinkLine,
      "También puedes responder desde el panel de conversaciones.",
    ].join("\n")
  );

  if (!params.accessToken) {
    await updateConversation(tenantId, botId, conversation.conversationId, {
      lastAdvisorNotifiedAt: new Date(now).toISOString(),
    });
    return;
  }

  try {
    await assertWhatsAppOutboundAllowed({
      tenantId: params.tenantId,
      phoneNumberId: params.phoneNumberId,
      kind: "service",
      to: advisor.phoneNumber.replace(/\D/g, ""),
    });
    await sendTextMessage({
      phoneNumberId: params.phoneNumberId,
      to: advisor.phoneNumber.replace(/\D/g, ""),
      text: body,
      accessToken: params.accessToken,
    });
  } catch (err) {
    console.error(
      `Failed to notify advisor tenant=${tenantId} conversation=${conversation.conversationId}:`,
      err
    );
    return;
  }

  await updateConversation(tenantId, botId, conversation.conversationId, {
    lastAdvisorNotifiedAt: new Date(now).toISOString(),
  });
}
