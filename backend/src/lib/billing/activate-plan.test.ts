import { activateTenantPlan } from "./activate-plan.js";
import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";

jest.mock("../dynamodb/tenant.repository.js", () => ({
  getTenant: jest.fn(),
  updateTenant: jest.fn(),
}));

describe("activateTenantPlan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("extends from current period end when still active", async () => {
    (getTenant as jest.Mock).mockResolvedValue({
      tenantId: "tenant-1",
      currentPeriodEnd: "2026-06-20T12:00:00.000Z",
    });

    await activateTenantPlan("tenant-1", "pro");

    expect(updateTenant).toHaveBeenCalledWith("tenant-1", {
      plan: "pro",
      subscriptionStatus: "active",
      currentPeriodEnd: "2026-07-20T12:00:00.000Z",
      paymentProvider: "wompi",
    });
  });

  it("starts a new period when previous one expired", async () => {
    (getTenant as jest.Mock).mockResolvedValue({
      tenantId: "tenant-1",
      currentPeriodEnd: "2026-05-01T12:00:00.000Z",
    });

    await activateTenantPlan("tenant-1", "enterprise");

    expect(updateTenant).toHaveBeenCalledWith("tenant-1", {
      plan: "enterprise",
      subscriptionStatus: "active",
      currentPeriodEnd: "2026-07-07T12:00:00.000Z",
      paymentProvider: "wompi",
    });
  });
});
