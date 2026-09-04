import { resolveWhatsAppConnectCredentials } from "./resolve-connect-credentials.js";

jest.mock("../integrations/meta-app-credentials.js", () => ({
  resolveMetaAppCredential: jest.fn(),
}));

import { resolveMetaAppCredential } from "../integrations/meta-app-credentials.js";

const mockedResolve = resolveMetaAppCredential as jest.MockedFunction<
  typeof resolveMetaAppCredential
>;

describe("resolveWhatsAppConnectCredentials", () => {
  it("maps resolved meta app credential for connect", async () => {
    mockedResolve.mockResolvedValue({
      payload: {
        appId: "123",
        appSecret: "secret-abcdefghij",
        embeddedSignupConfigId: "cfg",
        webhookVerifyToken: "verify",
      },
      source: "reseller",
      ownerTenantId: "reseller-1",
    });

    const result = await resolveWhatsAppConnectCredentials("sub-1", "dev");
    expect(result.appId).toBe("123");
    expect(result.platformAppSecret).toBe("secret-abcdefghij");
    expect(result.metaAppOwnerTenantId).toBe("reseller-1");
  });

  it("throws when meta app is not configured", async () => {
    mockedResolve.mockResolvedValue(null);
    await expect(resolveWhatsAppConnectCredentials("tenant-1", "dev")).rejects.toMatchObject({
      statusCode: 400,
      code: "META_APP_NOT_CONFIGURED",
    });
  });
});
