import type { PaymentRequest } from "../../types/index.js";
import { buildSalesMetrics } from "./sales-metrics.js";

function payment(
  overrides: Partial<PaymentRequest> & Pick<PaymentRequest, "paymentId" | "botId">
): PaymentRequest {
  const now = new Date().toISOString();
  return {
    tenantId: "t1",
    contactPhone: "573000000000",
    amountInCents: 10000,
    currency: "COP",
    description: "Test payment",
    status: "paid",
    source: "manual",
    reference: "ref-1",
    checkoutUrl: "https://checkout.wompi.co/l/test",
    paidAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("sales metrics", () => {
  const range = { from: "2026-07-01", to: "2026-07-31" };
  const botNames = new Map([
    ["b1", "Bot 1"],
    ["b2", "Bot 2"],
  ]);

  it("aggregates paid payments within date range", () => {
    const metrics = buildSalesMetrics(
      [
        payment({
          paymentId: "p1",
          botId: "b1",
          amountInCents: 50000,
          paidAt: "2026-07-10T12:00:00.000Z",
          source: "catalog_order",
        }),
        payment({
          paymentId: "p2",
          botId: "b2",
          amountInCents: 30000,
          paidAt: "2026-07-15T12:00:00.000Z",
          source: "flow",
        }),
        payment({
          paymentId: "p3",
          botId: "b1",
          amountInCents: 20000,
          status: "pending",
        }),
        payment({
          paymentId: "p4",
          botId: "b1",
          amountInCents: 10000,
          paidAt: "2026-06-30T23:59:59.000Z",
        }),
      ],
      range,
      botNames
    );

    expect(metrics.totalRevenueInCents).toBe(80000);
    expect(metrics.paidCount).toBe(2);
    expect(metrics.averageTicketInCents).toBe(40000);
    expect(metrics.bySource.catalog_order.count).toBe(1);
    expect(metrics.bySource.catalog_order.revenueInCents).toBe(50000);
    expect(metrics.bySource.flow.count).toBe(1);
    expect(metrics.bySource.manual.count).toBe(0);
  });

  it("ranks top bots by revenue", () => {
    const metrics = buildSalesMetrics(
      [
        payment({
          paymentId: "p1",
          botId: "b1",
          amountInCents: 10000,
          paidAt: "2026-07-05T12:00:00.000Z",
        }),
        payment({
          paymentId: "p2",
          botId: "b2",
          amountInCents: 50000,
          paidAt: "2026-07-06T12:00:00.000Z",
        }),
        payment({
          paymentId: "p3",
          botId: "b1",
          amountInCents: 20000,
          paidAt: "2026-07-07T12:00:00.000Z",
        }),
      ],
      range,
      botNames
    );

    expect(metrics.byBot).toHaveLength(2);
    expect(metrics.byBot[0]?.botId).toBe("b2");
    expect(metrics.byBot[0]?.revenueInCents).toBe(50000);
    expect(metrics.byBot[1]?.botId).toBe("b1");
    expect(metrics.byBot[1]?.revenueInCents).toBe(30000);
  });

  it("returns zero totals when no paid payments match", () => {
    const metrics = buildSalesMetrics(
      [
        payment({
          paymentId: "p1",
          botId: "b1",
          status: "pending",
        }),
      ],
      range,
      botNames
    );

    expect(metrics.totalRevenueInCents).toBe(0);
    expect(metrics.paidCount).toBe(0);
    expect(metrics.averageTicketInCents).toBe(0);
    expect(metrics.byBot).toHaveLength(0);
  });
});
