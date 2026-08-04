import { sendEmail } from "./client.js";

function loginUrl(customDomain?: string): string {
  if (customDomain) {
    const host = customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/login`;
  }
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/login`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendSubaccountInviteEmail(params: {
  to: string;
  ownerName: string;
  subaccountName: string;
  resellerName: string;
  temporaryPassword: string;
  customDomain?: string;
}): Promise<{ sent: boolean }> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping subaccount invite email");
    return { sent: false };
  }

  const url = loginUrl(params.customDomain);
  const subject = `Tu cuenta en ${params.subaccountName}`;
  const text = [
    `Hola ${params.ownerName},`,
    "",
    `${params.resellerName} te ha creado la cuenta "${params.subaccountName}".`,
    "",
    `Inicia sesión aquí: ${url}`,
    `Correo: ${params.to}`,
    `Contraseña temporal: ${params.temporaryPassword}`,
    "",
    "En tu primer inicio de sesión deberás cambiar la contraseña.",
  ].join("\n");

  const html = `
    <p>Hola ${escapeHtml(params.ownerName)},</p>
    <p><strong>${escapeHtml(params.resellerName)}</strong> te ha creado la cuenta <strong>${escapeHtml(params.subaccountName)}</strong>.</p>
    <p><a href="${escapeHtml(url)}">Iniciar sesión</a></p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Correo</strong></td><td>${escapeHtml(params.to)}</td></tr>
      <tr><td><strong>Contraseña temporal</strong></td><td><code>${escapeHtml(params.temporaryPassword)}</code></td></tr>
    </table>
  `.trim();

  try {
    await sendEmail({ to: [params.to], subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send subaccount invite email:", error);
    return { sent: false };
  }
}
