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

function tenant(plan: Tenant["plan"], overrides: Partial<Tenant> = {}): Tenant {
  return {
    tenantId: `${plan}-tenant`,
    name: "Tenant",
    email: "tenant@example.com",
    plan,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getEffectivePlanLimits", () => {
  it("keeps branding enabled for resellers when overrides disable it", () => {
    const limits = getEffectivePlanLimits(
      reseller({
        resellerConfig: {
          maxSubaccounts: 25,
          defaultSubaccountPlan: "pro",
          allowSubaccountBranding: false,
          limitsOverride: {
            canCustomizeBranding: false,
            maxActiveBots: 10,
          },
        },
      })
    );

    expect(limits.canCustomizeBranding).toBe(true);
    expect(limits.maxActiveBots).toBe(10);
  });

  it("limits WhatsApp channels to one for free, starter and pro", () => {
    expect(getEffectivePlanLimits(tenant("free")).maxWhatsAppChannelsPerBot).toBe(1);
    expect(getEffectivePlanLimits(tenant("starter")).maxWhatsAppChannelsPerBot).toBe(1);
    expect(getEffectivePlanLimits(tenant("pro")).maxWhatsAppChannelsPerBot).toBe(1);
  });

  it("allows 60 WhatsApp channels on scale", () => {
    expect(getEffectivePlanLimits(tenant("scale")).maxWhatsAppChannelsPerBot).toBe(60);
  });

  it("allows unlimited WhatsApp channels for reseller", () => {
    expect(getEffectivePlanLimits(reseller()).maxWhatsAppChannelsPerBot).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("limits hosted forms by plan", () => {
    expect(getEffectivePlanLimits(tenant("free")).maxHostedFormsPerTenant).toBe(1);
    expect(getEffectivePlanLimits(tenant("starter")).maxHostedFormsPerTenant).toBe(3);
    expect(getEffectivePlanLimits(tenant("pro")).maxHostedFormsPerTenant).toBe(10);
  });
});
