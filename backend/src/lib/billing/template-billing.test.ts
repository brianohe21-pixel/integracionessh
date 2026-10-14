import type { PlatformBillingConfig, Tenant } from "../../types/index.js";
import {
  buildTemplateBillingSnapshot,
  getTemplateCreditCapCount,
  resolveUnitPriceCents,
} from "./template-billing.js";
import { PlanLimitError } from "./plan-limits.js";

function starter(overrides: Partial<Tenant> = {}): Tenant {
  return {
    tenantId: "t1",
    name: "Starter Co",
    email: "starter@example.com",
    plan: "starter",
    status: "active",
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const config: PlatformBillingConfig = {
  pricePerMessageCents: 25_000,
  currency: "COP",
  maxMessagesPerMonthByPlan: {
    free: 250,
    starter: 2_000,
    pro: 10_000,
    reseller: 50_000,
  },
  templateCreditCapCount: 100,
};

describe("template billing", () => {
  it("uses platform price when period price is not locked", () => {
    expect(resolveUnitPriceCents(starter(), 25_000)).toBe(25_000);
  });

  it("prefers locked period price over platform price", () => {
    expect(
      resolveUnitPriceCents(
        starter({ billingPeriodAppliedPricePerMessageCents: 30_000 }),
        25_000
      )
    ).toBe(30_000);
  });

  it("prefers tenant override when period price is not locked", () => {
    expect(
      resolveUnitPriceCents(starter({ pricePerMessageCents: 40_000 }), 25_000)
    ).toBe(40_000);
  });

  it("builds fee from accepted templates and unit price", () => {
    const snapshot = buildTemplateBillingSnapshot(
      starter({
        billingPeriodTemplatesAcceptedCount: 3,
        billingPeriodAppliedPricePerMessageCents: 25_000,
      }),
      config
    );
    expect(snapshot.templatesAcceptedCount).toBe(3);
    expect(snapshot.templateFeeCents).toBe(75_000);
    expect(snapshot.creditCapReached).toBe(false);
    expect(snapshot.templatesBlocked).toBe(false);
  });

  it("marks credit cap reached and blocks templates", () => {
    const snapshot = buildTemplateBillingSnapshot(
      starter({ billingPeriodTemplatesAcceptedCount: 100 }),
      config
    );
    expect(snapshot.creditCapReached).toBe(true);
    expect(snapshot.blockReason).toBe("credit_cap");
    expect(snapshot.templatesBlocked).toBe(true);
  });

  it("blocks templates when past_due", () => {
    const snapshot = buildTemplateBillingSnapshot(
      starter({ subscriptionStatus: "past_due" }),
      config
    );
    expect(snapshot.blockReason).toBe("past_due");
    expect(snapshot.templatesBlocked).toBe(true);
  });

  it("treats zero credit cap as unlimited", () => {
    expect(getTemplateCreditCapCount({ templateCreditCapCount: 0 })).toBeNull();
    expect(getTemplateCreditCapCount({})).toBeNull();
  });

  it("does not apply credit cap outside starter", () => {
    const snapshot = buildTemplateBillingSnapshot(
      starter({
        plan: "pro",
        billingPeriodTemplatesAcceptedCount: 10_000,
      }),
      config
    );
    expect(snapshot.creditCapCount).toBeNull();
    expect(snapshot.creditCapReached).toBe(false);
  });
});

describe("PlanLimitError codes", () => {
  it("exposes TEMPLATE_CREDIT_CAP code shape", () => {
    const error = new PlanLimitError("TEMPLATE_CREDIT_CAP", "cap");
    expect(error.code).toBe("TEMPLATE_CREDIT_CAP");
    expect(error.statusCode).toBe(402);
  });
});
