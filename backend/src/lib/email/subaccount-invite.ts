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

export type SubaccountInviteEmailResult = {
  sent: boolean;
  failureReason?: "not_configured" | "recipient_not_verified" | "send_failed";
};

function inviteEmailFailureReason(
  error: unknown
): NonNullable<SubaccountInviteEmailResult["failureReason"]> {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not verified") || message.includes("MessageRejected")) {
    return "recipient_not_verified";
  }
  return "send_failed";
}

export async function sendSubaccountInviteEmail(params: {
  to: string;
  ownerName: string;
  subaccountName: string;
  resellerName: string;
  temporaryPassword: string;
  customDomain?: string;
}): Promise<SubaccountInviteEmailResult> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping subaccount invite email");
    return { sent: false, failureReason: "not_configured" };
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
    return { sent: false, failureReason: inviteEmailFailureReason(error) };
  }
}
