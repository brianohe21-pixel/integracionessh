import { sendEmail } from "./client.js";

const DEFAULT_BRAND_NAME = "Integraciones SSH";

const PLATFORM_HIGHLIGHTS = [
  {
    title: "Conversaciones omnicanal",
    description:
      "Centraliza mensajes de WhatsApp, Instagram, email, SMS, web chat y más en una sola bandeja.",
  },
  {
    title: "Bots con IA",
    description: "Crea asistentes inteligentes que respondan a tus clientes en cualquier canal conectado.",
  },
  {
    title: "Flujos y automatizaciones",
    description: "Diseña experiencias de bienvenida, seguimiento y atención sin esfuerzo manual.",
  },
  {
    title: "Centro de ayuda",
    description: "Encuentra guías, tutoriales y soporte para sacarle el máximo provecho a la plataforma.",
  },
] as const;

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function dashboardUrl(): string {
  return `${frontendBaseUrl()}/dashboard`;
}

function onboardingUrl(): string {
  return `${frontendBaseUrl()}/onboarding`;
}

function helpManualUrl(): string {
  return `${frontendBaseUrl()}/docs/manual`;
}

function platformBrandName(): string {
  return process.env.PLATFORM_EMAIL_BRAND_NAME?.trim() || DEFAULT_BRAND_NAME;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type WelcomeEmailResult = {
  sent: boolean;
  failureReason?: "not_configured" | "recipient_not_verified" | "send_failed";
};

function welcomeEmailFailureReason(error: unknown): NonNullable<WelcomeEmailResult["failureReason"]> {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not verified") || message.includes("MessageRejected")) {
    return "recipient_not_verified";
  }
  return "send_failed";
}

function buildWelcomeEmailContent(params: { userName: string }) {
  const brandName = platformBrandName();
  const dashboard = dashboardUrl();
  const onboarding = onboardingUrl();
  const helpManual = helpManualUrl();
  const subject = `¡Bienvenido a ${brandName}!`;

  const highlightsText = PLATFORM_HIGHLIGHTS.map(
    (item) => `• ${item.title}: ${item.description}`
  ).join("\n");

  const text = [
    `Hola ${params.userName},`,
    "",
    `¡Nos alegra tenerte en ${brandName}!`,
    "",
    "Tu cuenta ya está lista. Conecta tus canales — WhatsApp, Instagram, email, SMS y más — y centraliza todas tus conversaciones con bots de inteligencia artificial y automatizaciones.",
    "",
    "Te invitamos a explorar la plataforma y descubrir todo lo que puedes hacer:",
    "",
    highlightsText,
    "",
    `Explorar la plataforma: ${dashboard}`,
    `Guía de inicio rápido: ${onboarding}`,
    `Manual de ayuda: ${helpManual}`,
    "",
    "Si tienes alguna duda, responde a este correo. Estamos aquí para ayudarte.",
  ].join("\n");

  const highlightsHtml = PLATFORM_HIGHLIGHTS.map(
    (item) => `<li style="margin-bottom:14px;">
      <strong>${escapeHtml(item.title)}</strong><br />
      <span style="color:#4b5563;">${escapeHtml(item.description)}</span>
    </li>`
  ).join("");

  const html = `
    <p>Hola ${escapeHtml(params.userName)},</p>
    <p>¡Nos alegra tenerte en <strong>${escapeHtml(brandName)}</strong>!</p>
    <p>Tu cuenta ya está lista. Conecta tus canales — WhatsApp, Instagram, email, SMS y más — y centraliza todas tus conversaciones con bots de inteligencia artificial y automatizaciones.</p>
    <p>Te invitamos a explorar la plataforma y descubrir todo lo que puedes hacer:</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#1f2937;list-style:disc;">
      ${highlightsHtml}
    </ul>
    <p style="margin:0 0 16px;">
      <a href="${escapeHtml(dashboard)}" style="display:inline-block;background-color:#000000;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
        Explorar la plataforma
      </a>
    </p>
    <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">
      ¿Prefieres una guía paso a paso? <a href="${escapeHtml(onboarding)}">Comienza aquí</a>.
    </p>
    <p style="margin:0;color:#4b5563;font-size:14px;">
      También puedes consultar el <a href="${escapeHtml(helpManual)}">manual de ayuda</a> cuando lo necesites.
    </p>
    <p style="margin:16px 0 0;color:#666;font-size:12px;">
      Si tienes alguna duda, responde a este correo. Estamos aquí para ayudarte.
    </p>
  `.trim();

  return { subject, text, html };
}

export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
}): Promise<WelcomeEmailResult> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) {
    console.warn("SES_FROM_EMAIL is not configured; skipping welcome email");
    return { sent: false, failureReason: "not_configured" };
  }

  const { subject, text, html } = buildWelcomeEmailContent({ userName: params.userName });

  try {
    await sendEmail({
      to: [params.to],
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { sent: false, failureReason: welcomeEmailFailureReason(error) };
  }
}
