import type {
  PaymentRequest,
  PaymentRequestSource,
  SalesMetrics,
  SalesMetricsByBot,
  SalesMetricsBySource,
} from "../../types/index.js";
import { isWithinDateRange } from "./call-metrics.js";

const ALL_SOURCES: PaymentRequestSource[] = [
  "manual",
  "flow",
  "catalog_order",
  "calendar_booking",
  "quotation",
];

function emptyBySource(): Record<PaymentRequestSource, SalesMetricsBySource> {
  return ALL_SOURCES.reduce(
    (acc, source) => {
      acc[source] = { count: 0, revenueInCents: 0 };
      return acc;
    },
    {} as Record<PaymentRequestSource, SalesMetricsBySource>
  );
}

export function buildSalesMetrics(
  payments: PaymentRequest[],
  range: { from: string; to: string },
  botNames: Map<string, string>
): Omit<SalesMetrics, "topProducts"> {
  const paid = payments.filter(
    (payment) =>
      payment.status === "paid" &&
      payment.paidAt &&
      isWithinDateRange(payment.paidAt, range.from, range.to)
  );

  const totalRevenueInCents = paid.reduce((sum, payment) => sum + payment.amountInCents, 0);
  const paidCount = paid.length;
  const averageTicketInCents =
    paidCount > 0 ? Math.round(totalRevenueInCents / paidCount) : 0;

  const bySource = emptyBySource();
  for (const payment of paid) {
    const bucket = bySource[payment.source];
    bucket.count += 1;
    bucket.revenueInCents += payment.amountInCents;
  }

  const byBotMap = new Map<string, { count: number; revenueInCents: number }>();
  for (const payment of paid) {
    const current = byBotMap.get(payment.botId) ?? { count: 0, revenueInCents: 0 };
    current.count += 1;
    current.revenueInCents += payment.amountInCents;
    byBotMap.set(payment.botId, current);
  }

  const byBot: SalesMetricsByBot[] = [...byBotMap.entries()]
    .map(([botId, stats]) => ({
      botId,
      botName: botNames.get(botId) ?? botId,
      count: stats.count,
      revenueInCents: stats.revenueInCents,
    }))
    .sort((a, b) => b.revenueInCents - a.revenueInCents)
    .slice(0, 5);

  return {
    from: range.from,
    to: range.to,
    totalRevenueInCents,
    paidCount,
    averageTicketInCents,
    bySource,
    byBot,
  };
}
