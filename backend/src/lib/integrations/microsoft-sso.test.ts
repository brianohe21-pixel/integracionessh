import {
  buildMicrosoftProviderName,
} from "../dynamodb/microsoft-sso.repository.js";
import { maskClientSecret } from "../integrations/microsoft-sso-secrets.js";
import {
  buildOidcIssuer,
  buildSamlMetadataUrl,
} from "../integrations/microsoft-sso.validation.js";

describe("microsoft sso helpers", () => {
  it("builds stable provider names under cognito limit", () => {
    const tenantId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const name = buildMicrosoftProviderName(tenantId);
    expect(name.startsWith("entra-")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(32);
  });

  it("masks client secrets", () => {
    expect(maskClientSecret("abcdefghijklmnop")).toBe("********mnop");
    expect(maskClientSecret("ab")).toBe("********");
  });

  it("builds issuer and metadata urls", () => {
    const tenantId = "11111111-2222-3333-4444-555555555555";
    expect(buildOidcIssuer(tenantId)).toBe(
      "https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/v2.0"
    );
    expect(buildSamlMetadataUrl(tenantId)).toContain("federationmetadata.xml");
  });
});
