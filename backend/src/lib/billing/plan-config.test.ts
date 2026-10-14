import { assertAllowedModel } from "./plan-config.js";
import { PlanLimitError } from "./plan-limits.js";
import type { Tenant } from "../../types/index.js";

function tenantWithPlan(plan: Tenant["plan"]): Tenant {
  return {
    tenantId: "tenant-1",
    plan,
    createdAt: "2026-01-01T00:00:00.000Z",
  } as Tenant;
}

describe("assertAllowedModel", () => {
  it("allows economy models on starter", () => {
    expect(() => assertAllowedModel(tenantWithPlan("starter"), "gpt-4.1-mini")).not.toThrow();
    expect(() => assertAllowedModel(tenantWithPlan("starter"), "gpt-5-nano")).not.toThrow();
  });

  it("rejects pro models on starter with a Pro upgrade message", () => {
    expect(() => assertAllowedModel(tenantWithPlan("starter"), "gpt-4.1")).toThrow(PlanLimitError);
    try {
      assertAllowedModel(tenantWithPlan("starter"), "gpt-5");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanLimitError);
      expect((error as PlanLimitError).code).toBe("PLAN_MODEL_NOT_ALLOWED");
      expect((error as Error).message).toContain("Upgrade to Pro");
    }
  });

  it("allows the full catalog on pro", () => {
    expect(() => assertAllowedModel(tenantWithPlan("pro"), "gpt-4.1")).not.toThrow();
    expect(() => assertAllowedModel(tenantWithPlan("pro"), "o3")).not.toThrow();
  });
});
