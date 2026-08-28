import { normalizeTenantPlan } from "./normalize-plan.js";

describe("normalizeTenantPlan", () => {
  it("maps legacy enterprise to scale", () => {
    expect(normalizeTenantPlan("enterprise")).toBe("scale");
  });

  it("keeps scale unchanged", () => {
    expect(normalizeTenantPlan("scale")).toBe("scale");
  });

  it("defaults unknown plans to free", () => {
    expect(normalizeTenantPlan("unknown")).toBe("free");
  });
});
