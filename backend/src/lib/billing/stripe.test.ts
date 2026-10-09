import { planFromPriceId } from "./stripe.js";

describe("planFromPriceId", () => {
  const originalEnterprise = process.env.STRIPE_PRICE_ENTERPRISE;
  const originalPro = process.env.STRIPE_PRICE_PRO;
  const originalStarter = process.env.STRIPE_PRICE_STARTER;

  afterEach(() => {
    process.env.STRIPE_PRICE_ENTERPRISE = originalEnterprise;
    process.env.STRIPE_PRICE_PRO = originalPro;
    process.env.STRIPE_PRICE_STARTER = originalStarter;
  });

  it("maps the legacy enterprise price to pro", () => {
    process.env.STRIPE_PRICE_ENTERPRISE = "price_enterprise";
    process.env.STRIPE_PRICE_PRO = "price_pro";
    expect(planFromPriceId("price_enterprise")).toBe("pro");
    expect(planFromPriceId("price_pro")).toBe("pro");
  });

  it("does not treat an empty enterprise price as a match", () => {
    process.env.STRIPE_PRICE_ENTERPRISE = "";
    expect(planFromPriceId("price_other")).toBeNull();
  });
});
