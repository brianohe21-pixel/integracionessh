import {
  countEnabledPayments,
  getPaymentsConfig,
  listEnabledPaymentsConfigs,
  upsertPaymentsConfig,
} from "../dynamodb/payments-config.repository.js";
import {
  createPaymentRequestRecord,
  getPaymentRequest,
  listPaymentRequestsForBot,
} from "../dynamodb/payment-request.repository.js";
import type {
  PaymentRequest,
  PaymentRequestSource,
  PaymentsConfig,
} from "../../types/index.js";
import { createPaymentCheckout } from "./checkout.js";
import { getTenantWompiCredentials, getTenantWompiSecrets } from "./wompi-secrets.js";
import { sendPaymentLinkMessage } from "./notify.js";

export function defaultPaymentsConfig(tenantId: string, botId: string): PaymentsConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    botId,
    enabled: false,
    currency: "COP",
    paymentMessageTemplate: "Paga {{amount}} por {{description}} aquí: {{url}}",
    createdAt: now,
    updatedAt: now,
  };
}

export async function getConfigOrDefault(
  tenantId: string,
  botId: string
): Promise<PaymentsConfig> {
  const existing = await getPaymentsConfig(tenantId, botId);
  return existing ?? defaultPaymentsConfig(tenantId, botId);
}

export async function enablePayments(tenantId: string, botId: string): Promise<PaymentsConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertPaymentsConfig({ ...existing, enabled: true });
}

export async function disablePayments(tenantId: string, botId: string): Promise<PaymentsConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertPaymentsConfig({ ...existing, enabled: false });
}

export async function savePaymentsConfig(
  tenantId: string,
  botId: string,
  patch: Partial<
    Pick<
      PaymentsConfig,
      "defaultAmountInCents" | "paymentMessageTemplate" | "successRedirectUrl"
    >
  >
): Promise<PaymentsConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertPaymentsConfig({ ...existing, ...patch });
}

export async function requireEnabledPayments(
  tenantId: string,
  botId: string
): Promise<PaymentsConfig> {
  const config = await getConfigOrDefault(tenantId, botId);
  if (!config.enabled) {
    throw new Error("Payments app is not enabled for this bot");
  }
  return config;
}

export async function requireTenantWompiConfigured(
  tenantId: string,
  environment: string
): Promise<void> {
  const secrets = await getTenantWompiSecrets(tenantId, environment);
  if (!secrets) {
    throw new Error("Wompi credentials are not configured");
  }
}

export async function listEnabledPaymentsForTenant(tenantId: string): Promise<PaymentsConfig[]> {
  return listEnabledPaymentsConfigs(tenantId);
}

export async function countEnabledPaymentsForTenant(tenantId: string): Promise<number> {
  return countEnabledPayments(tenantId);
}

export async function createPaymentRequest(params: {
  tenantId: string;
  botId: string;
  amountInCents: number;
  description: string;
  contactPhone: string;
  contactName?: string;
  source: PaymentRequestSource;
  conversationId?: string;
  flowRunId?: string;
  bookingId?: string;
  customerEmail?: string;
  environment: string;
  sendWhatsApp?: boolean;
}): Promise<PaymentRequest> {
  const config = await requireEnabledPayments(params.tenantId, params.botId);
  await requireTenantWompiConfigured(params.tenantId, params.environment);

  const creds = await getTenantWompiCredentials(params.tenantId, params.environment);
  if (!creds) throw new Error("Wompi credentials are not configured");

  if (params.amountInCents < 1000) {
    throw new Error("Minimum payment amount is 1000 cents (COP $10)");
  }

  const { paymentId, reference, checkoutUrl } = createPaymentCheckout({
    creds,
    tenantId: params.tenantId,
    botId: params.botId,
    amountInCents: params.amountInCents,
    currency: config.currency,
    customerEmail: params.customerEmail ?? `${params.contactPhone}@payments.local`,
    ...(config.successRedirectUrl ? { successRedirectUrl: config.successRedirectUrl } : {}),
  });

  const now = new Date().toISOString();
  let conversationId = params.conversationId;

  if (params.sendWhatsApp !== false) {
    const sent = await sendPaymentLinkMessage({
      tenantId: params.tenantId,
      botId: params.botId,
      contactPhone: params.contactPhone,
      ...(params.contactName ? { contactName: params.contactName } : {}),
      amountInCents: params.amountInCents,
      description: params.description,
      checkoutUrl,
      ...(config.paymentMessageTemplate
        ? { messageTemplate: config.paymentMessageTemplate }
        : {}),
      environment: params.environment,
    });
    conversationId = sent.conversation.conversationId;
  }

  const request: PaymentRequest = {
    paymentId,
    tenantId: params.tenantId,
    botId: params.botId,
    contactPhone: params.contactPhone,
    ...(params.contactName ? { contactName: params.contactName } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(params.flowRunId ? { flowRunId: params.flowRunId } : {}),
    ...(params.bookingId ? { bookingId: params.bookingId } : {}),
    amountInCents: params.amountInCents,
    currency: config.currency,
    description: params.description,
    status: "pending",
    source: params.source,
    reference,
    checkoutUrl,
    createdAt: now,
    updatedAt: now,
  };

  return createPaymentRequestRecord(request);
}

export async function listPaymentRequests(params: {
  tenantId: string;
  botId: string;
  status?: PaymentRequest["status"];
  limit?: number;
}): Promise<PaymentRequest[]> {
  await getConfigOrDefault(params.tenantId, params.botId);
  return listPaymentRequestsForBot(params);
}

export async function getPaymentRequestById(
  tenantId: string,
  botId: string,
  paymentId: string
): Promise<PaymentRequest | null> {
  const request = await getPaymentRequest(tenantId, paymentId);
  if (!request || request.botId !== botId) return null;
  return request;
}

export async function isTenantWompiConfigured(
  tenantId: string,
  environment: string
): Promise<boolean> {
  const secrets = await getTenantWompiSecrets(tenantId, environment);
  return secrets !== null;
}
