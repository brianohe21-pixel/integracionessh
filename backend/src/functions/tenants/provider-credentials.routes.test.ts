import { providerFromRequest } from "./provider-credentials.routes.js";

describe("providerFromRequest", () => {
  it("reads the provider from the tenants proxy path", () => {
    expect(
      providerFromRequest(
        {
          rawPath: "/tenants/me/provider-credentials/openai",
          pathParameters: { proxy: "provider-credentials/openai" },
        }
      )
    ).toBe("openai");
  });

  it("reads a named provider path parameter", () => {
    expect(
      providerFromRequest(
        {
          rawPath: "/tenants/me/provider-credentials/telnyx",
          pathParameters: { provider: "telnyx" },
        }
      )
    ).toBe("telnyx");
  });

  it("returns undefined for the collection path", () => {
    expect(
      providerFromRequest(
        {
          rawPath: "/tenants/me/provider-credentials",
          pathParameters: { proxy: "provider-credentials" },
        }
      )
    ).toBeUndefined();
  });
});
