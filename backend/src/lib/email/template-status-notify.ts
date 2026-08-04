import { sendEmail } from "./client.js";

function templatesUrl(): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/templates`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type TemplateNotifyParams = {
  to: string;
  tenantName: string;
  templateName: string;
  language: string;
  category: string;
};

async function sendTemplateNotifyEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping template notification email");
    return;
  }

  const to = params.to.trim();
  if (!to) {
    console.warn("No recipient for template notification email; skipping");
    return;
  }

  await sendEmail({
    to: [to],
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

export async function sendTemplateCreatedEmail(params: TemplateNotifyParams): Promise<void> {
  const url = templatesUrl();
  const subject = `Plantilla enviada a revisión: ${params.templateName}`;
  const text = [
    `Hola,`,
    "",
    `Tu plantilla de WhatsApp "${params.templateName}" fue creada en ${params.tenantName} y enviada a revisión de Meta.`,
    "",
    `Nombre: ${params.templateName}`,
    `Idioma: ${params.language}`,
    `Categoría: ${params.category}`,
    `Estado: PENDING`,
    "",
    `Te avisaremos por correo cuando Meta la apruebe y quede activa.`,
    "",
    `Ver plantillas: ${url}`,
  ].join("\n");

  const html = `
    <p>Hola,</p>
    <p>Tu plantilla de WhatsApp <strong>${escapeHtml(params.templateName)}</strong> fue creada en <strong>${escapeHtml(params.tenantName)}</strong> y enviada a revisión de Meta.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Nombre</strong></td><td>${escapeHtml(params.templateName)}</td></tr>
      <tr><td><strong>Idioma</strong></td><td>${escapeHtml(params.language)}</td></tr>
      <tr><td><strong>Categoría</strong></td><td>${escapeHtml(params.category)}</td></tr>
      <tr><td><strong>Estado</strong></td><td>PENDING</td></tr>
    </table>
    <p>Te avisaremos por correo cuando Meta la apruebe y quede activa.</p>
    <p><a href="${escapeHtml(url)}">Ver plantillas</a></p>
  `.trim();

  await sendTemplateNotifyEmail({ to: params.to, subject, text, html });
}

export async function sendTemplateApprovedEmail(params: TemplateNotifyParams): Promise<void> {
  const url = templatesUrl();
  const subject = `Plantilla activa: ${params.templateName}`;
  const text = [
    `Hola,`,
    "",
    `Tu plantilla de WhatsApp "${params.templateName}" fue aprobada por Meta y ya está activa en ${params.tenantName}.`,
    "",
    `Nombre: ${params.templateName}`,
    `Idioma: ${params.language}`,
    `Categoría: ${params.category}`,
    `Estado: APPROVED`,
    "",
    `Ya puedes usarla para enviar mensajes.`,
    "",
    `Ver plantillas: ${url}`,
  ].join("\n");

  const html = `
    <p>Hola,</p>
    <p>Tu plantilla de WhatsApp <strong>${escapeHtml(params.templateName)}</strong> fue aprobada por Meta y ya está activa en <strong>${escapeHtml(params.tenantName)}</strong>.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Nombre</strong></td><td>${escapeHtml(params.templateName)}</td></tr>
      <tr><td><strong>Idioma</strong></td><td>${escapeHtml(params.language)}</td></tr>
      <tr><td><strong>Categoría</strong></td><td>${escapeHtml(params.category)}</td></tr>
      <tr><td><strong>Estado</strong></td><td>APPROVED</td></tr>
    </table>
    <p>Ya puedes usarla para enviar mensajes.</p>
    <p><a href="${escapeHtml(url)}">Ver plantillas</a></p>
  `.trim();

  await sendTemplateNotifyEmail({ to: params.to, subject, text, html });
}
