import { getPaymentsConfig } from "../dynamodb/payments-config.repository.js";
import { isTenantWompiConfigured } from "../payments/payments.service.js";
import type { CalendarConfig, PaymentsConfig } from "../../types/index.js";

export const MIN_BOOKING_PAYMENT_CENTS = 1000;

export function formatAmountCop(amountInCents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}

export function resolveBookingAmountInCents(
  calendarConfig: CalendarConfig,
  paymentsConfig?: PaymentsConfig | null
): number | null {
  if (!calendarConfig.autoCollectPayment) return null;

  if (
    calendarConfig.bookingPriceInCents &&
    calendarConfig.bookingPriceInCents >= MIN_BOOKING_PAYMENT_CENTS
  ) {
    return calendarConfig.bookingPriceInCents;
  }

  if (
    paymentsConfig?.defaultAmountInCents &&
    paymentsConfig.defaultAmountInCents >= MIN_BOOKING_PAYMENT_CENTS
  ) {
    return paymentsConfig.defaultAmountInCents;
  }

  return null;
}

export async function getCalendarPaymentInfo(params: {
  tenantId: string;
  botId: string;
  calendarConfig: CalendarConfig;
  environment: string;
}): Promise<{
  required: boolean;
  amountInCents?: number;
  currency: "COP";
  amountLabel?: string;
}> {
  const paymentsConfig = await getPaymentsConfig(params.tenantId, params.botId);
  const wompiConfigured = await isTenantWompiConfigured(params.tenantId, params.environment);
  const amountInCents = resolveBookingAmountInCents(params.calendarConfig, paymentsConfig);
  const required = Boolean(
    paymentsConfig?.enabled && wompiConfigured && amountInCents !== null
  );

  return {
    required,
    ...(amountInCents !== null ? { amountInCents } : {}),
    currency: "COP",
    ...(amountInCents !== null ? { amountLabel: formatAmountCop(amountInCents) } : {}),
  };
}
