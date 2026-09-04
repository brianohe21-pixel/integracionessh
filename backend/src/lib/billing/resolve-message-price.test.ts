import {
  resolveTenantPricePerMessageCents,
  tenantUsesCustomMessagePrice,
} from "./resolve-message-price.js";

describe("resolve message price", () => {
  it("uses platform default when tenant has no override", () => {
    expect(resolveTenantPricePerMessageCents({}, 150)).toBe(150);
    expect(tenantUsesCustomMessagePrice({})).toBe(false);
  });

  it("uses tenant override when configured", () => {
    expect(resolveTenantPricePerMessageCents({ pricePerMessageCents: 250 }, 150)).toBe(250);
    expect(tenantUsesCustomMessagePrice({ pricePerMessageCents: 250 })).toBe(true);
  });
});
