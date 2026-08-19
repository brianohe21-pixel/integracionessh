import type { Tenant } from "../../types/index.js";
import {
  SUBACCOUNT_SERVICES,
  assertBagAllocation,
  assertSubaccountService,
  BagLimitExceededError,
  buildResellerBag,
  isSubaccountServiceEnabled,
  normalizeEnabledServices,
  normalizeServiceLimits,
  ServiceNotAssignedError,
  sumAllocatedLimits,
  trimServiceLimitsForEnabled,
} from "./subaccount-services.js";
import { getEffectivePlanLimits, getPlanLimits } from "./plan-limits.js";

function child(overrides: Partial<Tenant> = {}): Tenant {
  return {
    tenantId: "child-1",
    name: "Child",
    email: "child@example.com",
    plan: "pro",
    status: "active",
    tenantKind: "subaccount",
    parentTenantId: "parent-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("subaccount-services", () => {
  it("normalizes enabled services to unique catalog order", () => {
    expect(normalizeEnabledServices(["campaigns", "bots", "bots", "nope"])).toEqual([
      "bots",
      "campaigns",
    ]);
  });

  it("defaults missing enabled services to the full catalog", () => {
    expect(normalizeEnabledServices(undefined)).toEqual([...SUBACCOUNT_SERVICES]);
  });

  it("trims limits of disabled services", () => {
    const trimmed = trimServiceLimitsForEnabled(["contacts"], {
      maxContacts: 100,
      maxActiveBots: 4,
    });
    expect(trimmed).toEqual({ maxContacts: 100 });
  });

  it("treats missing enabledServices as all enabled for subaccounts", () => {
    expect(isSubaccountServiceEnabled(child(), "bots")).toBe(true);
  });

  it("blocks unassigned services", () => {
    const tenant = child({ enabledServices: ["contacts"] });
    expect(isSubaccountServiceEnabled(tenant, "bots")).toBe(false);
    expect(() => assertSubaccountService(tenant, "bots")).toThrow(ServiceNotAssignedError);
  });

  it("allows all services for non-subaccounts", () => {
    const tenant = child({ tenantKind: "standard" });
    Reflect.deleteProperty(tenant, "parentTenantId");
    expect(isSubaccountServiceEnabled(tenant, "bots")).toBe(true);
  });

  it("sums sibling allocations and rejects over-bag values", () => {
    const siblings = [
      child({
        tenantId: "a",
        serviceLimits: { maxActiveBots: 3, maxContacts: 200 },
      }),
    ];
    expect(sumAllocatedLimits(siblings).maxActiveBots).toBe(3);

    const limited = {
      ...getPlanLimits("pro"),
      maxActiveBots: 5,
      maxContacts: 1000,
    };
    expect(() =>
      assertBagAllocation(limited, siblings, { maxActiveBots: 3 })
    ).toThrow(BagLimitExceededError);
    expect(() =>
      assertBagAllocation(limited, siblings, { maxActiveBots: 2 })
    ).not.toThrow();
  });

  it("skips bag checks when the reseller quota is unlimited", () => {
    const reseller = getPlanLimits("reseller");
    expect(() =>
      assertBagAllocation(reseller, [], { maxActiveBots: 999_999 })
    ).not.toThrow();
  });

  it("builds remaining bag values", () => {
    const bag = buildResellerBag(
      { ...getPlanLimits("pro"), maxActiveBots: 10 },
      [child({ serviceLimits: { maxActiveBots: 4 } })]
    );
    expect(bag.allocated.maxActiveBots).toBe(4);
    expect(bag.remaining.maxActiveBots).toBe(6);
  });

  it("drops invalid service limit keys", () => {
    expect(
      normalizeServiceLimits({
        maxActiveBots: 2.8,
        canCustomizeBranding: true,
        nope: 1,
      } as Record<string, unknown>)
    ).toEqual({ maxActiveBots: 2 });
  });

  it("uses serviceLimits as effective plan limits for subaccounts", () => {
    const limits = getEffectivePlanLimits(
      child({ serviceLimits: { maxActiveBots: 3, maxContacts: 80 } })
    );
    expect(limits.maxActiveBots).toBe(3);
    expect(limits.maxContacts).toBe(80);
    expect(limits.maxMessagesPerMonth).toBe(0);
  });

  it("keeps the child plan when serviceLimits is missing", () => {
    const limits = getEffectivePlanLimits(child());
    expect(limits.maxActiveBots).toBe(getPlanLimits("pro").maxActiveBots);
  });
});
