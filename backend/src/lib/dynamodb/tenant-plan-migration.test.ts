import { getTenant, listTenants } from "./tenant.repository.js";
import { docClient } from "./client.js";

jest.mock("./client.js", () => ({
  docClient: { send: jest.fn() },
  TABLE_NAME: "test-table",
}));

jest.mock("../email/registration-admin-notify.js", () => ({
  notifyAdminsOfNewRegistration: jest.fn(),
}));

jest.mock("../email/welcome.js", () => ({
  sendWelcomeEmail: jest.fn(),
}));

const send = docClient.send as jest.Mock;

function tenantItem(plan: string) {
  return {
    PK: "TENANT#t1",
    SK: "METADATA",
    GSI1PK: "TENANT",
    GSI1SK: "STATUS#active#t1",
    tenantId: "t1",
    name: "Acme",
    email: "a@acme.com",
    plan,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("legacy scale plan migration", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("rewrites a scale tenant to pro on read", async () => {
    send.mockImplementation(async (command: { input?: { UpdateExpression?: string } }) => {
      if (command.input?.UpdateExpression) return {};
      return { Item: tenantItem("scale") };
    });

    const tenant = await getTenant("t1");

    expect(tenant?.plan).toBe("pro");
    const update = send.mock.calls
      .map(([command]) => command.input)
      .find((input) => typeof input?.UpdateExpression === "string");
    expect(update?.ExpressionAttributeValues).toEqual(
      expect.objectContaining({
        ":plan": "pro",
        ":legacyPlan": "scale",
      })
    );
  });

  it("rewrites enterprise tenants to pro when listing", async () => {
    send.mockImplementation(async (command: { input?: { UpdateExpression?: string } }) => {
      if (command.input?.UpdateExpression) return {};
      return { Items: [tenantItem("enterprise")] };
    });

    const tenants = await listTenants();

    expect(tenants.map((tenant) => tenant.plan)).toEqual(["pro"]);
    const update = send.mock.calls
      .map(([command]) => command.input)
      .find((input) => typeof input?.UpdateExpression === "string");
    expect(update?.ExpressionAttributeValues[":legacyPlan"]).toBe("enterprise");
  });

  it("leaves pro tenants unchanged", async () => {
    send.mockResolvedValue({ Item: tenantItem("pro") });

    const tenant = await getTenant("t1");

    expect(tenant?.plan).toBe("pro");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
