import { assertCanCustomizeBranding } from "./assert-plan.js";
import { PlanLimitError } from "./plan-limits.js";
import type { Tenant } from "../../types/index.js";

function tenant(plan: Tenant["plan"]): Tenant {
  return {
    tenantId: "t1",
    name: "Test",
    email: "t@test.com",
    plan,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("assertCanCustomizeBranding", () => {
  it("allows enterprise tenants", () => {
    expect(() => assertCanCustomizeBranding(tenant("enterprise"))).not.toThrow();
  });

  it("blocks free and pro tenants", () => {
    expect(() => assertCanCustomizeBranding(tenant("free"))).toThrow(PlanLimitError);
    expect(() => assertCanCustomizeBranding(tenant("pro"))).toThrow(PlanLimitError);
  });
});
