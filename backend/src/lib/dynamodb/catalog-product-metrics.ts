import type { CatalogOrder, OrderItem, SalesMetricsTopProduct } from "../../types/index.js";
import { isWithinDateRange } from "./call-metrics.js";

function productKey(item: OrderItem): string {
  return item.productId ?? item.retailerId;
}

export function buildTopProductsMetrics(
  orders: CatalogOrder[],
  range: { from: string; to: string }
): SalesMetricsTopProduct[] {
  const eligible = orders.filter(
    (order) =>
      order.status !== "cancelled" &&
      isWithinDateRange(order.createdAt, range.from, range.to)
  );

  const byProduct = new Map<
    string,
    {
      productId?: string;
      name: string;
      orderIds: Set<string>;
      quantity: number;
      revenueInCents: number;
    }
  >();

  for (const order of eligible) {
    for (const item of order.items) {
      const key = productKey(item);
      const current = byProduct.get(key) ?? {
        ...(item.productId ? { productId: item.productId } : {}),
        name: item.name,
        orderIds: new Set<string>(),
        quantity: 0,
        revenueInCents: 0,
      };
      current.orderIds.add(order.orderId);
      current.quantity += item.quantity;
      current.revenueInCents += item.quantity * item.unitPriceInCents;
      if (!current.name && item.name) {
        current.name = item.name;
      }
      byProduct.set(key, current);
    }
  }

  return [...byProduct.entries()]
    .map(([key, stats]) => ({
      productKey: key,
      ...(stats.productId ? { productId: stats.productId } : {}),
      name: stats.name,
      orderCount: stats.orderIds.size,
      quantity: stats.quantity,
      revenueInCents: stats.revenueInCents,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}
