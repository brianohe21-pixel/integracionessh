import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildIntegrationPayload } from "../integrations/payloads.js";
import { resumeFlowRunById } from "../flow/interpreter.js";
import {
  getPaymentRequest,
  updatePaymentRequest,
} from "../dynamodb/payment-request.repository.js";
import { fetchWompiTransaction } from "../billing/wompi.js";
import { getTenantWompiCredentials } from "./wompi-secrets.js";
import { parseTenantPaymentReference } from "./checkout.js";
import { sendPaymentConfirmationMessage } from "./notify.js";
import {
  cancelBookingForFailedPayment,
  finalizeBookingAfterPayment,
} from "../calendar/calendar.service.js";
import type { PaymentRequest } from "../../types/index.js";

export async function fulfillTenantPayment(params: {
  tenantId: string;
  reference: string;
  transactionId?: string;
  environment: string;
}): Promise<PaymentRequest | null> {
  const parsed = parseTenantPaymentReference(params.reference);
  if (!parsed || parsed.tenantId !== params.tenantId) return null;

  const existing = await getPaymentRequest(params.tenantId, parsed.paymentId);
  if (!existing) return null;
  if (existing.status === "paid") return existing;

  if (params.transactionId) {
    const creds = await getTenantWompiCredentials(params.tenantId, params.environment);
    if (!creds) return null;
    const tx = await fetchWompiTransaction(creds, params.transactionId);
    if (!tx || tx.reference !== params.reference) return null;
    if (tx.status !== "APPROVED") {
      if (tx.status === "DECLINED" || tx.status === "ERROR" || tx.status === "VOIDED") {
        await declineTenantPayment({
          tenantId: params.tenantId,
          reference: params.reference,
          transactionId: params.transactionId,
          environment: params.environment,
        });
      }
      return null;
    }
  }

  const now = new Date().toISOString();
  const updated = await updatePaymentRequest(params.tenantId, parsed.paymentId, {
    status: "paid",
    paidAt: now,
    ...(params.transactionId ? { wompiTransactionId: params.transactionId } : {}),
  });
  if (!updated) return null;

  await sendPaymentConfirmationMessage({
    tenantId: updated.tenantId,
    botId: updated.botId,
    contactPhone: updated.contactPhone,
    amountInCents: updated.amountInCents,
    description: updated.description,
    environment: params.environment,
  });

  await emitIntegrationEvent(
    params.tenantId,
    "payment.completed",
    buildIntegrationPayload({
      event: "payment.completed",
      tenantId: params.tenantId,
      data: {
        paymentId: updated.paymentId,
        botId: updated.botId,
        contactPhone: updated.contactPhone,
        amountInCents: updated.amountInCents,
        currency: updated.currency,
        description: updated.description,
        reference: updated.reference,
        paidAt: updated.paidAt ?? now,
      },
    })
  );

  if (updated.flowRunId) {
    await resumeFlowRunById(params.tenantId, updated.flowRunId);
  }

  if (updated.bookingId) {
    await finalizeBookingAfterPayment({
      tenantId: params.tenantId,
      bookingId: updated.bookingId,
      environment: params.environment,
    });
  }

  return updated;
}

export async function declineTenantPayment(params: {
  tenantId: string;
  reference: string;
  transactionId?: string;
  environment: string;
}): Promise<PaymentRequest | null> {
  const parsed = parseTenantPaymentReference(params.reference);
  if (!parsed || parsed.tenantId !== params.tenantId) return null;

  const existing = await getPaymentRequest(params.tenantId, parsed.paymentId);
  if (!existing || existing.status === "paid") return existing;

  const updated = await updatePaymentRequest(params.tenantId, parsed.paymentId, {
    status: "declined",
    ...(params.transactionId ? { wompiTransactionId: params.transactionId } : {}),
  });
  if (!updated) return null;

  if (updated.bookingId) {
    await cancelBookingForFailedPayment({
      tenantId: params.tenantId,
      bookingId: updated.bookingId,
    });
  }

  await emitIntegrationEvent(
    params.tenantId,
    "payment.failed",
    buildIntegrationPayload({
      event: "payment.failed",
      tenantId: params.tenantId,
      data: {
        paymentId: updated.paymentId,
        botId: updated.botId,
        contactPhone: updated.contactPhone,
        amountInCents: updated.amountInCents,
        currency: updated.currency,
        description: updated.description,
        reference: updated.reference,
        status: updated.status,
      },
    })
  );

  return updated;
}
