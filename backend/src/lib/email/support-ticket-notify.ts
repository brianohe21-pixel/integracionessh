import type { SupportTicket, SupportTicketCategory } from "../../types/index.js";
import { parseEmailList, sendEmail } from "./client.js";

const DEFAULT_SUPPORT_NOTIFICATION_EMAIL = "info@integracionessh.lat";

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  general: "General",
  technical: "Técnico",
  billing: "Facturación",
  whatsapp: "WhatsApp",
};

function supportTicketRecipients(): string[] {
  const configured = parseEmailList(process.env.SUPPORT_NOTIFICATION_EMAILS);
  if (configured.length > 0) return configured;

  const platformSupport = process.env.PLATFORM_EMAIL_SUPPORT?.trim();
  if (platformSupport) return [platformSupport];

  return [DEFAULT_SUPPORT_NOTIFICATION_EMAIL];
}

function adminSupportUrl(): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/admin/support`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifySupportTeamOfNewTicket(ticket: SupportTicket): Promise<void> {
  const recipients = supportTicketRecipients();
  if (recipients.length === 0) return;

  const createdAt = new Date(ticket.createdAt).toLocaleString("es-CO", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const categoryLabel = CATEGORY_LABELS[ticket.category];

  const subject = `[Soporte] ${ticket.subject}`;
  const text = [
    "Nuevo ticket de soporte en Integraciones SH.",
    "",
    `Asunto: ${ticket.subject}`,
    `Categoría: ${categoryLabel}`,
    `Email: ${ticket.email}`,
    `Tenant ID: ${ticket.tenantId}`,
    `Ticket ID: ${ticket.ticketId}`,
    `Fecha (UTC): ${createdAt}`,
    "",
    "Mensaje:",
    ticket.message,
    "",
    `Panel de soporte: ${adminSupportUrl()}`,
  ].join("\n");

  const html = `
    <p>Nuevo ticket de soporte en Integraciones SH.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Asunto</strong></td><td>${escapeHtml(ticket.subject)}</td></tr>
      <tr><td><strong>Categoría</strong></td><td>${escapeHtml(categoryLabel)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(ticket.email)}</td></tr>
      <tr><td><strong>Tenant ID</strong></td><td><code>${escapeHtml(ticket.tenantId)}</code></td></tr>
      <tr><td><strong>Ticket ID</strong></td><td><code>${escapeHtml(ticket.ticketId)}</code></td></tr>
      <tr><td><strong>Fecha (UTC)</strong></td><td>${escapeHtml(createdAt)}</td></tr>
    </table>
    <p><strong>Mensaje:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(ticket.message)}</p>
    <p><a href="${escapeHtml(adminSupportUrl())}">Abrir panel de soporte</a></p>
  `.trim();

  await sendEmail({ to: recipients, subject, text, html });
}
