import type { WompiCredentials } from "../billing/wompi.js";
import { buildCheckoutUrl, FRONTEND_URL } from "../billing/wompi.js";
import { makePaymentId } from "../dynamodb/payment-request.repository.js";

export function buildTenantPaymentReference(
  tenantId: string,
  botId: string,
  paymentId: string
): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `tpay|${tenantId}|${botId}|${paymentId}|${rand}`;
}

export function parseTenantPaymentReference(
  reference: string
): { tenantId: string; botId: string; paymentId: string } | null {
  const parts = reference.split("|");
  if (parts.length < 5 || parts[0] !== "tpay") return null;
  const tenantId = parts[1] ?? "";
  const botId = parts[2] ?? "";
  const paymentId = parts[3] ?? "";
  if (!tenantId || !botId || !paymentId) return null;
  return { tenantId, botId, paymentId };
}

export function createPaymentCheckout(input: {
  creds: WompiCredentials;
  tenantId: string;
  botId: string;
  amountInCents: number;
  currency?: "COP";
  customerEmail: string;
  successRedirectUrl?: string;
}): { paymentId: string; reference: string; checkoutUrl: string } {
  const paymentId = makePaymentId();
  const reference = buildTenantPaymentReference(input.tenantId, input.botId, paymentId);
  const redirectUrl =
    input.successRedirectUrl ??
    `${FRONTEND_URL}/payments/complete?reference=${encodeURIComponent(reference)}`;

  const checkoutUrl = buildCheckoutUrl(input.creds, {
    reference,
    amountInCents: input.amountInCents,
    redirectUrl,
    customerEmail: input.customerEmail,
    currency: input.currency ?? "COP",
  });

  return { paymentId, reference, checkoutUrl };
}

export function formatPaymentMessage(
  template: string | undefined,
  url: string,
  amountInCents: number,
  description: string
): string {
  const amountFormatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);

  const defaultTemplate = "Paga {{amount}} por {{description}} aquí: {{url}}";
  const text = (template?.trim() || defaultTemplate)
    .replace(/\{\{url\}\}/g, url)
    .replace(/\{\{amount\}\}/g, amountFormatted)
    .replace(/\{\{description\}\}/g, description);

  return text;
}
