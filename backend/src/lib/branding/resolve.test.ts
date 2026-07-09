import {
  buildLogoS3Key,
  DEFAULT_PRIMARY_COLOR,
  extensionForContentType,
  isValidPrimaryColor,
  normalizePrimaryColor,
  resolveBranding,
} from "./resolve.js";
import type { Tenant } from "../../types/index.js";

const baseTenant: Tenant = {
  tenantId: "t1",
  name: "Acme Corp",
  email: "a@acme.com",
  plan: "enterprise",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("branding resolve", () => {
  it("uses tenant name and default color when branding is empty", () => {
    expect(resolveBranding(baseTenant)).toEqual({
      brandName: "Acme Corp",
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
  });

  it("merges custom branding fields", () => {
    const tenant: Tenant = {
      ...baseTenant,
      branding: {
        brandName: "Acme Chat",
        primaryColor: "#ff5500",
        logoS3Key: "branding/t1/logo.png",
      },
    };
    expect(resolveBranding(tenant, "https://example.com/logo.png")).toEqual({
      brandName: "Acme Chat",
      primaryColor: "#ff5500",
      logoUrl: "https://example.com/logo.png",
    });
  });

  it("validates and normalizes hex colors", () => {
    expect(isValidPrimaryColor("#AABBCC")).toBe(true);
    expect(isValidPrimaryColor("AABBCC")).toBe(false);
    expect(normalizePrimaryColor("#AABBCC")).toBe("#aabbcc");
    expect(normalizePrimaryColor("invalid")).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it("maps content types to file extensions", () => {
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("image/png")).toBe("png");
  });

  it("builds logo keys under branding prefix", () => {
    expect(buildLogoS3Key("t1", "png")).toBe("branding/t1/logo.png");
  });
});
