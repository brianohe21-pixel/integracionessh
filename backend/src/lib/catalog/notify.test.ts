import { formatOrderConfirmationMessage } from "./notify.js";
import type { CatalogOrder } from "../../types/index.js";

describe("formatOrderConfirmationMessage", () => {
  const order: CatalogOrder = {
    orderId: "order-12345678",
    tenantId: "t1",
    botId: "b1",
    contactPhone: "573001234567",
    status: "pending",
    catalogId: "cat-1",
    items: [
      {
        retailerId: "sku-1",
        name: "Hamburguesa",
        quantity: 2,
        unitPriceInCents: 1500000,
        currency: "COP",
      },
    ],
    subtotalInCents: 3000000,
    currency: "COP",
    source: "whatsapp_cart",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };

  it("uses default template when none provided", () => {
    const text = formatOrderConfirmationMessage(undefined, order);
    expect(text).toContain("order-12");
    expect(text).toContain("Hamburguesa");
  });

  it("replaces template variables", () => {
    const text = formatOrderConfirmationMessage(
      "Pedido {{order_id}} total {{total}} items {{items_count}}",
      order
    );
    expect(text).toContain("order-12345678");
    expect(text).toContain("1");
  });
});
