import { getBot } from "../dynamodb/bot.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { sendEmail } from "../email/client.js";
import { getWhatsAppAccessToken, sendTemplateMessage } from "../whatsapp/client.js";
import type { Booking, CalendarConfig } from "../../types/index.js";
import { formatDateLabel, formatSlotLabel } from "./slot-engine.js";

function bookingsUrl(botId: string): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/apps/calendar/${encodeURIComponent(botId)}?tab=bookings`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ownerNotifyTemplateParams(
  booking: Booking,
  config: CalendarConfig
): { name: string; date: string; time: string; phone: string } {
  return {
    name: booking.contactName?.trim() || "Cliente",
    date: formatDateLabel(booking.startAt.slice(0, 10), config.timezone),
    time: formatSlotLabel(new Date(booking.startAt), config.timezone),
    phone: booking.contactPhone,
  };
}

function buildOwnerNotifyEmail(params: {
  booking: Booking;
  config: CalendarConfig;
  botName: string;
}): { subject: string; text: string; html: string } {
  const vars = ownerNotifyTemplateParams(params.booking, params.config);
  const contactEmail = params.booking.contactEmail?.trim() || "";
  const href = bookingsUrl(params.booking.botId);
  const source = params.booking.source;

  const subject = `Nueva cita — ${vars.date} ${vars.time} (${params.botName})`;
  const text = [
    "Se agendó una nueva cita.",
    "",
    `Bot: ${params.botName}`,
    `Fecha: ${vars.date}`,
    `Hora: ${vars.time}`,
    `Contacto: ${vars.name}`,
    `Teléfono: ${vars.phone}`,
    ...(contactEmail ? [`Email: ${contactEmail}`] : []),
    `Origen: ${source}`,
    `Reserva: ${params.booking.bookingId}`,
    "",
    `Ver reservas: ${href}`,
  ].join("\n");

  const html = `
    <p>Se agendó una nueva cita.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Bot</strong></td><td>${escapeHtml(params.botName)}</td></tr>
      <tr><td><strong>Fecha</strong></td><td>${escapeHtml(vars.date)}</td></tr>
      <tr><td><strong>Hora</strong></td><td>${escapeHtml(vars.time)}</td></tr>
      <tr><td><strong>Contacto</strong></td><td>${escapeHtml(vars.name)}</td></tr>
      <tr><td><strong>Teléfono</strong></td><td>${escapeHtml(vars.phone)}</td></tr>
      ${
        contactEmail
          ? `<tr><td><strong>Email</strong></td><td>${escapeHtml(contactEmail)}</td></tr>`
          : ""
      }
      <tr><td><strong>Origen</strong></td><td>${escapeHtml(source)}</td></tr>
      <tr><td><strong>Reserva</strong></td><td><code>${escapeHtml(params.booking.bookingId)}</code></td></tr>
    </table>
    <p><a href="${escapeHtml(href)}">Ver reservas</a></p>
  `.trim();

  return { subject, text, html };
}

export async function notifyOwnerOfBooking(params: {
  tenantId: string;
  booking: Booking;
  config: CalendarConfig;
}): Promise<void> {
  if (!params.config.ownerNotifyEnabled) return;

  const notifyEmail = params.config.ownerNotifyEmail !== false;
  const notifyWhatsApp = Boolean(params.config.ownerNotifyWhatsApp);
  if (!notifyEmail && !notifyWhatsApp) return;

  const [tenant, bot] = await Promise.all([
    getTenant(params.tenantId),
    getBot(params.tenantId, params.booking.botId),
  ]);
  if (!tenant) return;

  if (notifyEmail) {
    const email = tenant.email?.trim().toLowerCase();
    if (email) {
      const body = buildOwnerNotifyEmail({
        booking: params.booking,
        config: params.config,
        botName: bot?.name?.trim() || params.booking.botId,
      });
      await sendEmail({
        to: [email],
        subject: body.subject,
        text: body.text,
        html: body.html,
      }).catch((error) => {
        console.warn("Owner booking email notify failed:", error);
      });
    }
  }

  if (notifyWhatsApp) {
    const phone = (params.config.ownerNotifyPhone ?? "").replace(/\D/g, "");
    const templateName = params.config.ownerNotifyTemplateName?.trim();
    const templateLanguage = params.config.ownerNotifyTemplateLanguage?.trim();
    if (!phone || !bot?.phoneNumberId || !templateName || !templateLanguage) {
      console.warn("Owner WhatsApp notify skipped: missing phone, bot, or template");
      return;
    }

    try {
      const environment = process.env.ENVIRONMENT ?? "dev";
      const accessToken = await getWhatsAppAccessToken(params.tenantId, environment);
      const vars = ownerNotifyTemplateParams(params.booking, params.config);
      await sendTemplateMessage({
        phoneNumberId: bot.phoneNumberId,
        to: phone,
        templateName,
        language: templateLanguage,
        accessToken,
        billingTenantId: params.tenantId,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: vars.name },
              { type: "text", text: vars.date },
              { type: "text", text: vars.time },
              { type: "text", text: vars.phone },
            ],
          },
        ],
      });
    } catch (error) {
      console.warn("Owner booking WhatsApp notify failed:", error);
    }
  }
}

export function notifyOwnerOfBookingSafe(params: {
  tenantId: string;
  booking: Booking;
  config: CalendarConfig;
}): void {
  void notifyOwnerOfBooking(params).catch((error) => {
    console.error("Failed to notify owner of booking:", error);
  });
}
