import {
  isReservedPlatformDomain,
  splitFqdn,
} from "./custom-domain.js";

describe("splitFqdn", () => {
  it("splits a standard three-label hostname", () => {
    expect(splitFqdn("app.empresa.com")).toEqual({
      rootDomain: "empresa.com",
      prefix: "app",
    });
  });

  it("treats two-label hosts as apex", () => {
    expect(splitFqdn("empresa.com")).toEqual({
      rootDomain: "empresa.com",
      prefix: "",
    });
  });

  it("splits nested subdomains on a standard TLD", () => {
    expect(splitFqdn("portal.app.empresa.com")).toEqual({
      rootDomain: "empresa.com",
      prefix: "portal.app",
    });
  });

  it("treats empresa.com.co as apex", () => {
    expect(splitFqdn("empresa.com.co")).toEqual({
      rootDomain: "empresa.com.co",
      prefix: "",
    });
  });

  it("splits app.empresa.com.co using the registrable root", () => {
    expect(splitFqdn("app.empresa.com.co")).toEqual({
      rootDomain: "empresa.com.co",
      prefix: "app",
    });
  });

  it("splits nested hosts on co.uk", () => {
    expect(splitFqdn("app.empresa.co.uk")).toEqual({
      rootDomain: "empresa.co.uk",
      prefix: "app",
    });
  });

  it("normalizes protocol and trailing slash", () => {
    expect(splitFqdn("https://App.Empresa.COM/")).toEqual({
      rootDomain: "empresa.com",
      prefix: "app",
    });
  });

  it("rejects hosts with fewer than two labels", () => {
    expect(() => splitFqdn("localhost")).toThrow("Invalid domain");
  });
});

describe("isReservedPlatformDomain", () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it("rejects the platform host and other hosts on the same registrable root", () => {
    process.env.FRONTEND_URL = "https://app.integracionessh.lat";
    expect(isReservedPlatformDomain("app.integracionessh.lat")).toBe(true);
    expect(isReservedPlatformDomain("portal.integracionessh.lat")).toBe(true);
    expect(isReservedPlatformDomain("integracionessh.lat")).toBe(true);
    expect(isReservedPlatformDomain("app.cliente.com")).toBe(false);
    expect(isReservedPlatformDomain("app.empresa.com.co")).toBe(false);
  });

  it("only exact-matches Amplify default hosts", () => {
    process.env.FRONTEND_URL = "https://main.d123.amplifyapp.com";
    expect(isReservedPlatformDomain("main.d123.amplifyapp.com")).toBe(true);
    expect(isReservedPlatformDomain("preview.main.d123.amplifyapp.com")).toBe(true);
    expect(isReservedPlatformDomain("main.other.amplifyapp.com")).toBe(false);
  });

  it("ignores localhost", () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    expect(isReservedPlatformDomain("localhost")).toBe(false);
    expect(isReservedPlatformDomain("app.cliente.com")).toBe(false);
  });
});
