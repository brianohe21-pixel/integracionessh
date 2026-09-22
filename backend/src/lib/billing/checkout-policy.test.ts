import { assertCheckoutAllowed, canCheckoutPlan } from "./checkout-policy.js";
import { PlanLimitError } from "./plan-limits.js";
import type { Tenant } from "../../types/index.js";

function tenant(plan: Tenant["plan"]): Tenant {
  return {
    tenantId: "t1",
    name: "Test",
    email: "test@example.com",
    plan,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("checkout policy", () => {
  it("allows starter for everyone", () => {
    expect(canCheckoutPlan(tenant("free"), "starter")).toBe(true);
    expect(canCheckoutPlan(tenant("pro"), "starter")).toBe(true);
  });

  it("blocks pro self-service checkout", () => {
    expect(canCheckoutPlan(tenant("free"), "pro")).toBe(false);
    expect(() => assertCheckoutAllowed(tenant("pro"), "pro")).toThrow(PlanLimitError);
  });

  it("allows scale renewal only for scale tenants", () => {
    expect(canCheckoutPlan(tenant("scale"), "scale")).toBe(true);
    expect(canCheckoutPlan(tenant("starter"), "scale")).toBe(false);
  });
});
