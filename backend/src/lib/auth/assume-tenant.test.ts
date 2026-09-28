import type { AuthContext, Tenant } from "../../types/index.js";
import { resolveAssumedTenant } from "./cognito.js";

jest.mock("../dynamodb/tenant.repository.js", () => ({
  getTenant: jest.fn(),
}));

import { getTenant } from "../dynamodb/tenant.repository.js";

const mockedGetTenant = getTenant as jest.MockedFunction<typeof getTenant>;

function memberAuth(tenantId = "reseller-1"): AuthContext {
  return {
    tenantId,
    userId: "user-1",
    email: "owner@example.com",
    role: "member",
  };
}

function tenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    tenantId: "sub-1",
    name: "Sub",
    email: "sub@example.com",
    plan: "starter",
    status: "active",
    parentTenantId: "reseller-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveAssumedTenant", () => {
  beforeEach(() => {
    mockedGetTenant.mockReset();
  });

  it("keeps the home tenant when no subaccount is requested", async () => {
    const auth = memberAuth();
    await expect(resolveAssumedTenant(auth, "")).resolves.toBe(auth);
    expect(mockedGetTenant).not.toHaveBeenCalled();
  });

  it("assumes an active child tenant", async () => {
    mockedGetTenant.mockResolvedValue(tenant());
    const result = await resolveAssumedTenant(memberAuth(), "sub-1");
    expect(result.tenantId).toBe("sub-1");
    expect(result.homeTenantId).toBe("reseller-1");
  });

  it("rejects a tenant that is not a child of the reseller", async () => {
    mockedGetTenant.mockResolvedValue(tenant({ parentTenantId: "other" }));
    await expect(resolveAssumedTenant(memberAuth(), "sub-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects a suspended subaccount", async () => {
    mockedGetTenant.mockResolvedValue(tenant({ status: "suspended" }));
    await expect(resolveAssumedTenant(memberAuth(), "sub-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects advisors assuming a subaccount", async () => {
    await expect(
      resolveAssumedTenant({ ...memberAuth(), role: "advisor" }, "sub-1")
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedGetTenant).not.toHaveBeenCalled();
  });
});
