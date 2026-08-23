import type { Tenant } from "../../types/index.js";
import { getEffectivePlanLimits } from "./plan-limits.js";

function reseller(overrides: Partial<Tenant> = {}): Tenant {
  return {
    tenantId: "reseller-1",
    name: "Reseller",
    email: "reseller@example.com",
    plan: "reseller",
    status: "active",
    tenantKind: "reseller",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getEffectivePlanLimits", () => {
  it("keeps branding enabled for resellers when overrides disable it", () => {
    const tenant = reseller({
      resellerConfig: {
        maxSubaccounts: 25,
        defaultSubaccountPlan: "pro",
        allowSubaccountBranding: false,
        limitsOverride: {
          canCustomizeBranding: false,
          maxActiveBots: 10,
        },
      },
    });

    const limits = getEffectivePlanLimits(tenant);

    expect(limits.canCustomizeBranding).toBe(true);
    expect(limits.maxActiveBots).toBe(10);
  });
});
