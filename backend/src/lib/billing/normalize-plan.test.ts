import { normalizeTenantPlan } from "./normalize-plan.js";

describe("normalizeTenantPlan", () => {
  it("maps legacy enterprise to pro", () => {
    expect(normalizeTenantPlan("enterprise")).toBe("pro");
  });

  it("keeps scale unchanged", () => {
    expect(normalizeTenantPlan("scale")).toBe("scale");
  });

  it("defaults unknown plans to free", () => {
    expect(normalizeTenantPlan("unknown")).toBe("free");
  });
});
