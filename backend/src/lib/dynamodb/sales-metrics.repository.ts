import { listBots } from "./bot.repository.js";
import { listAllOrdersForTenant } from "./order.repository.js";
import { listAllPaymentRequestsForTenant } from "./payment-request.repository.js";
import { buildTopProductsMetrics } from "./catalog-product-metrics.js";
import { resolveMetricsDateRange } from "./call-metrics.js";
import { buildSalesMetrics } from "./sales-metrics.js";
import type { SalesMetrics } from "../../types/index.js";

export async function getSalesMetrics(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<SalesMetrics> {
  const range = resolveMetricsDateRange(options);
  const botId = options.botId?.trim();

  const [payments, orders, bots] = await Promise.all([
    listAllPaymentRequestsForTenant(tenantId),
    listAllOrdersForTenant(tenantId),
    listBots(tenantId),
  ]);

  const scopedPayments = botId ? payments.filter((payment) => payment.botId === botId) : payments;
  const scopedOrders = botId ? orders.filter((order) => order.botId === botId) : orders;
  const scopedBots = botId ? bots.filter((bot) => bot.botId === botId) : bots;
  const botNames = new Map(scopedBots.map((bot) => [bot.botId, bot.name]));

  return {
    ...buildSalesMetrics(scopedPayments, range, botNames),
    topProducts: buildTopProductsMetrics(scopedOrders, range),
  };
}
