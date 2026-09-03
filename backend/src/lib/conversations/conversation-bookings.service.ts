import { randomUUID } from "crypto";
import {
  createBookingForBot,
  buildBookingConfirmationText,
  getAvailableSlots,
  getConfigOrDefault,
} from "../calendar/calendar.service.js";
import { buildOutboundContext, sendChannelText } from "../channels/router.js";
import { addMessage } from "../dynamodb/conversation.repository.js";
import { resolveAccessTokenForBot } from "../quotations/channel-access.js";
import { getSystemMessage } from "../i18n/messages.js";
import type { AvailableSlot, Bot, Conversation } from "../../types/index.js";

export async function listConversationBookingSlots(params: {
  tenantId: string;
  botId: string;
  from?: string;
  to?: string;
  environment: string;
}): Promise<{ enabled: boolean; slots: AvailableSlot[]; timezone?: string }> {
  const config = await getConfigOrDefault(params.tenantId, params.botId);
  if (!config.enabled) {
    return { enabled: false, slots: [] };
  }

  const slots = await getAvailableSlots({
    tenantId: params.tenantId,
    botId: params.botId,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    environment: params.environment,
  });

  return {
    enabled: true,
    slots,
    timezone: config.timezone,
  };
}

export async function createAndSendConversationBooking(input: {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  environment: string;
  startAt: string;
  notes?: string;
  createdByAdvisorId?: string;
}) {
  const contactPhone =
    input.conversation.phoneNumber ?? input.conversation.participantId ?? "";
  if (!contactPhone) {
    throw new Error("Conversation has no contact phone");
  }

  const result = await createBookingForBot({
    tenantId: input.tenantId,
    botId: input.botId,
    startAt: input.startAt,
    contactPhone,
    ...(input.conversation.contactName ? { contactName: input.conversation.contactName } : {}),
    conversationId: input.conversation.conversationId,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    source: "manual",
    environment: input.environment,
    sendPaymentWhatsApp: true,
  });

  const calendarConfig = await getConfigOrDefault(input.tenantId, input.botId);
  const locale = input.conversation.locale ?? input.bot.defaultLocale ?? "es";
  const confirmationBase = buildBookingConfirmationText({
    booking: result.booking,
    config: calendarConfig,
    locale,
  });
  let textBody = confirmationBase;
  if (input.notes?.trim()) {
    textBody += `\n\n${input.notes.trim()}`;
  }
  if (result.payment) {
    textBody = `${confirmationBase} ${getSystemMessage("bookingPaymentLink", locale)}`;
  }

  const channel = input.conversation.channel ?? "whatsapp";
  const accessToken = await resolveAccessTokenForBot(
    input.tenantId,
    input.botId,
    channel,
    input.environment
  );
  const outboundCtx = buildOutboundContext({
    tenantId: input.tenantId,
    botId: input.botId,
    bot: input.bot,
    conversation: input.conversation,
    accessToken,
    environment: input.environment,
  });

  const now = new Date().toISOString();
  let externalMessageId: string | undefined;
  try {
    const textResult = await sendChannelText(outboundCtx, textBody);
    externalMessageId = textResult.externalMessageId;
  } catch {
    externalMessageId = undefined;
  }

  await addMessage(
    {
      messageId: `adv-${randomUUID()}`,
      conversationId: input.conversation.conversationId,
      tenantId: input.tenantId,
      role: "advisor",
      content: textBody,
      channel,
      source: "panel",
      ...(input.createdByAdvisorId ? { sentByAdvisorId: input.createdByAdvisorId } : {}),
      ...(externalMessageId
        ? {
            externalMessageId,
            ...(channel === "whatsapp" ? { whatsappMessageId: externalMessageId } : {}),
          }
        : {}),
      timestamp: now,
    },
    input.botId
  );

  return result;
}
