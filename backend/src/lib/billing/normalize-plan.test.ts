import { normalizeTenantPlan } from "./normalize-plan.js";

describe("normalizeTenantPlan", () => {
  it("maps legacy enterprise and scale to pro", () => {
    expect(normalizeTenantPlan("enterprise")).toBe("pro");
    expect(normalizeTenantPlan("scale")).toBe("pro");
  });

  it("defaults unknown plans to free", () => {
    expect(normalizeTenantPlan("unknown")).toBe("free");
  });
});
