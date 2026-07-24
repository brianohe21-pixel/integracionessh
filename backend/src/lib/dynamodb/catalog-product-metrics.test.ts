import type { CatalogOrder } from "../../types/index.js";
import { buildTopProductsMetrics } from "./catalog-product-metrics.js";

function order(
  overrides: Partial<CatalogOrder> & Pick<CatalogOrder, "orderId">
): CatalogOrder {
  const now = "2026-07-10T12:00:00.000Z";
  return {
    tenantId: "t1",
    botId: "b1",
    contactPhone: "573000000000",
    status: "pending",
    catalogId: "cat-1",
    items: [],
    subtotalInCents: 0,
    currency: "COP",
    source: "whatsapp_cart",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("catalog product metrics", () => {
  const range = { from: "2026-07-01", to: "2026-07-31" };

  it("aggregates items by productId and ranks by quantity", () => {
    const metrics = buildTopProductsMetrics(
      [
        order({
          orderId: "o1",
          items: [
            {
              retailerId: "r1",
              productId: "p1",
              name: "Product A",
              quantity: 2,
              unitPriceInCents: 10000,
              currency: "COP",
            },
            {
              retailerId: "r2",
              productId: "p2",
              name: "Product B",
              quantity: 1,
              unitPriceInCents: 5000,
              currency: "COP",
            },
          ],
        }),
        order({
          orderId: "o2",
          items: [
            {
              retailerId: "r1",
              productId: "p1",
              name: "Product A",
              quantity: 3,
              unitPriceInCents: 10000,
              currency: "COP",
            },
          ],
        }),
      ],
      range
    );

    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({
      productKey: "p1",
      productId: "p1",
      name: "Product A",
      orderCount: 2,
      quantity: 5,
      revenueInCents: 50000,
    });
    expect(metrics[1]).toMatchObject({
      productKey: "p2",
      quantity: 1,
      orderCount: 1,
      revenueInCents: 5000,
    });
  });

  it("excludes cancelled orders and orders outside date range", () => {
    const metrics = buildTopProductsMetrics(
      [
        order({
          orderId: "o1",
          status: "cancelled",
          items: [
            {
              retailerId: "r1",
              productId: "p1",
              name: "Product A",
              quantity: 10,
              unitPriceInCents: 1000,
              currency: "COP",
            },
          ],
        }),
        order({
          orderId: "o2",
          createdAt: "2026-06-01T12:00:00.000Z",
          items: [
            {
              retailerId: "r1",
              productId: "p1",
              name: "Product A",
              quantity: 10,
              unitPriceInCents: 1000,
              currency: "COP",
            },
          ],
        }),
        order({
          orderId: "o3",
          items: [
            {
              retailerId: "r1",
              productId: "p2",
              name: "Product B",
              quantity: 1,
              unitPriceInCents: 2000,
              currency: "COP",
            },
          ],
        }),
      ],
      range
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.productKey).toBe("p2");
  });

  it("falls back to retailerId when productId is missing", () => {
    const metrics = buildTopProductsMetrics(
      [
        order({
          orderId: "o1",
          items: [
            {
              retailerId: "r99",
              name: "Legacy Product",
              quantity: 4,
              unitPriceInCents: 3000,
              currency: "COP",
            },
          ],
        }),
      ],
      range
    );

    expect(metrics[0]).toMatchObject({
      productKey: "r99",
      name: "Legacy Product",
      quantity: 4,
      revenueInCents: 12000,
    });
    expect(metrics[0]?.productId).toBeUndefined();
  });

  it("returns at most 5 products", () => {
    const metrics = buildTopProductsMetrics(
      Array.from({ length: 7 }, (_, index) =>
        order({
          orderId: `o${index}`,
          items: [
            {
              retailerId: `r${index}`,
              productId: `p${index}`,
              name: `Product ${index}`,
              quantity: 7 - index,
              unitPriceInCents: 1000,
              currency: "COP",
            },
          ],
        })
      ),
      range
    );

    expect(metrics).toHaveLength(5);
    expect(metrics[0]?.productKey).toBe("p0");
    expect(metrics[4]?.productKey).toBe("p4");
  });
});
