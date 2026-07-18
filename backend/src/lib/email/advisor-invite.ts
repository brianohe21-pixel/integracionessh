import { sendEmail } from "./client.js";

function loginUrl(): string {
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

export type AdvisorInviteEmailResult = {
  sent: boolean;
  failureReason?: "not_configured" | "recipient_not_verified" | "send_failed";
};

function inviteEmailFailureReason(error: unknown): NonNullable<AdvisorInviteEmailResult["failureReason"]> {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not verified") || message.includes("MessageRejected")) {
    return "recipient_not_verified";
  }
  return "send_failed";
}

export async function sendAdvisorInviteEmail(params: {
  to: string;
  advisorName: string;
  tenantName: string;
  temporaryPassword: string;
}): Promise<AdvisorInviteEmailResult> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping advisor invite email");
    return { sent: false, failureReason: "not_configured" };
  }

  const url = loginUrl();
  const subject = `Tu cuenta en ${params.tenantName}`;
  const text = [
    `Hola ${params.advisorName},`,
    "",
    `${params.tenantName} te ha creado una cuenta de asesor en la plataforma.`,
    "",
    `Inicia sesión aquí: ${url}`,
    `Correo: ${params.to}`,
    `Contraseña temporal: ${params.temporaryPassword}`,
    "",
    "En tu primer inicio de sesión deberás cambiar la contraseña.",
    "",
    "Si no esperabas este correo, puedes ignorarlo.",
  ].join("\n");

  const html = `
    <p>Hola ${escapeHtml(params.advisorName)},</p>
    <p><strong>${escapeHtml(params.tenantName)}</strong> te ha creado una cuenta de asesor en la plataforma.</p>
    <p><a href="${escapeHtml(url)}">Iniciar sesión</a></p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Correo</strong></td><td>${escapeHtml(params.to)}</td></tr>
      <tr><td><strong>Contraseña temporal</strong></td><td><code>${escapeHtml(params.temporaryPassword)}</code></td></tr>
    </table>
    <p>En tu primer inicio de sesión deberás cambiar la contraseña.</p>
    <p style="color:#666;font-size:12px">Si no esperabas este correo, puedes ignorarlo.</p>
  `.trim();

  try {
    await sendEmail({
      to: [params.to],
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send advisor invite email:", error);
    return { sent: false, failureReason: inviteEmailFailureReason(error) };
  }
}