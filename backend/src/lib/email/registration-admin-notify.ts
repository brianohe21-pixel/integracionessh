import type { Tenant } from "../../types/index.js";
import { parseEmailList, sendEmail } from "./client.js";

function adminRecipients(): string[] {
  return parseEmailList(process.env.ADMIN_NOTIFICATION_EMAILS);
}

function adminUsersUrl(): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/admin/users`;
}

export async function notifyAdminsOfNewRegistration(tenant: Tenant): Promise<void> {
  const recipients = adminRecipients();
  if (recipients.length === 0) return;

  const registeredAt = new Date(tenant.createdAt).toLocaleString("es-CO", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `Nuevo registro: ${tenant.name}`;
  const text = [
    "Se registró un nuevo usuario en la plataforma.",
    "",
    `Empresa: ${tenant.name}`,
    `Email: ${tenant.email}`,
    `Tenant ID: ${tenant.tenantId}`,
    `Plan: ${tenant.plan}`,
    `Fecha (UTC): ${registeredAt}`,
    "",
    `Panel de administración: ${adminUsersUrl()}`,
  ].join("\n");

  const html = `
    <p>Se registró un nuevo usuario en la plataforma.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Empresa</strong></td><td>${escapeHtml(tenant.name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(tenant.email)}</td></tr>
      <tr><td><strong>Tenant ID</strong></td><td><code>${escapeHtml(tenant.tenantId)}</code></td></tr>
      <tr><td><strong>Plan</strong></td><td>${escapeHtml(tenant.plan)}</td></tr>
      <tr><td><strong>Fecha (UTC)</strong></td><td>${escapeHtml(registeredAt)}</td></tr>
    </table>
    <p><a href="${escapeHtml(adminUsersUrl())}">Abrir panel de administración</a></p>
  `.trim();

  await sendEmail({ to: recipients, subject, text, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
