import { randomUUID } from "crypto";
import { getBot } from "../dynamodb/bot.repository.js";
import { getBooking, updateBooking } from "../dynamodb/booking.repository.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { addMessage } from "../dynamodb/conversation.repository.js";
import { getWhatsAppAccessToken, sendTemplateMessage, sendTextMessage } from "../whatsapp/client.js";
import type { CalendarConfig } from "../../types/index.js";
import {
  buildReminderText,
  reminderTemplateParams,
} from "./reminder-schedule.js";

export async function sendBookingReminder(params: {
  tenantId: string;
  botId: string;
  bookingId: string;
}): Promise<{ message: string }> {
  const booking = await getBooking(params.tenantId, params.bookingId);
  if (!booking || booking.botId !== params.botId) {
    return { message: "Booking not found, skipping." };
  }
  if (booking.status !== "confirmed") {
    return { message: "Booking not confirmed, skipping." };
  }
  if (booking.reminderSentAt) {
    return { message: "Reminder already sent, skipping." };
  }

  const config = await getCalendarConfig(params.tenantId, params.botId);
  if (!config?.enabled || !config.reminderEnabled) {
    return { message: "Reminders disabled, skipping." };
  }

  const bot = await getBot(params.tenantId, params.botId);
  if (!bot?.phoneNumberId) {
    return { message: "Bot not configured for WhatsApp, skipping." };
  }

  const environment = process.env.ENVIRONMENT ?? "dev";
  const accessToken = await getWhatsAppAccessToken(params.tenantId, environment);
  const phone = booking.contactPhone.replace(/\D/g, "");
  const channel = config.reminderChannel ?? "whatsapp_text";

  if (channel === "whatsapp_template") {
    if (!config.reminderTemplateName || !config.reminderTemplateLanguage) {
      return { message: "Template not configured, skipping." };
    }
    const vars = reminderTemplateParams(booking, config);
    await sendTemplateMessage({
      phoneNumberId: bot.phoneNumberId,
      to: phone,
      templateName: config.reminderTemplateName,
      language: config.reminderTemplateLanguage,
      accessToken,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: vars.name },
            { type: "text", text: vars.date },
            { type: "text", text: vars.time },
          ],
        },
      ],
    });
  } else {
    const text = buildReminderText(booking, config);
    await sendTextMessage({
      phoneNumberId: bot.phoneNumberId,
      to: phone,
      text,
      accessToken,
    });
  }

  const now = new Date().toISOString();
  await updateBooking(params.tenantId, params.bookingId, {
    reminderSentAt: now,
    reminderStatus: "sent",
  });

  if (booking.conversationId) {
    const vars = reminderTemplateParams(booking, config);
    const text =
      channel === "whatsapp_template"
        ? `Recordatorio de cita: ${vars.date} ${vars.time}`
        : buildReminderText(booking, config);
    await addMessage(
      {
        messageId: `reminder-${randomUUID().slice(0, 8)}`,
        conversationId: booking.conversationId,
        tenantId: params.tenantId,
        role: "assistant",
        content: text,
        channel: "whatsapp",
        messageType: "text",
        timestamp: now,
      },
      params.botId
    ).catch(() => {});
  }

  return { message: "Reminder sent." };
}

export function validateReminderConfig(
  config: Pick<
    CalendarConfig,
    | "reminderEnabled"
    | "reminderChannel"
    | "reminderMessage"
    | "reminderTemplateName"
    | "reminderTemplateLanguage"
    | "reminderMinutesBefore"
  >
): void {
  if (!config.reminderEnabled) return;

  const minutes = config.reminderMinutesBefore ?? 60;
  if (minutes < 15 || minutes > 10080) {
    throw new Error("reminderMinutesBefore must be between 15 and 10080");
  }

  const channel = config.reminderChannel ?? "whatsapp_text";
  if (channel === "whatsapp_template") {
    if (!config.reminderTemplateName?.trim()) {
      throw new Error("reminderTemplateName is required for template reminders");
    }
    if (!config.reminderTemplateLanguage?.trim()) {
      throw new Error("reminderTemplateLanguage is required for template reminders");
    }
  } else if (!config.reminderMessage?.trim()) {
    throw new Error("reminderMessage is required for text reminders");
  }
}
