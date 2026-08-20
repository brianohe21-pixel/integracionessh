const mockSend = jest.fn();

jest.mock("@aws-sdk/client-amplify", () => {
  class BaseCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  return {
    AmplifyClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    CreateDomainAssociationCommand: class CreateDomainAssociationCommand extends BaseCommand {},
    DeleteDomainAssociationCommand: class DeleteDomainAssociationCommand extends BaseCommand {},
    GetDomainAssociationCommand: class GetDomainAssociationCommand extends BaseCommand {},
    ListAppsCommand: class ListAppsCommand extends BaseCommand {},
    UpdateDomainAssociationCommand: class UpdateDomainAssociationCommand extends BaseCommand {},
  };
});

import {
  ensureResellerDomainInAmplify,
  isDomainTakenByAnotherApp,
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

describe("isDomainTakenByAnotherApp", () => {
  it("detects the Amplify conflict message", () => {
    expect(
      isDomainTakenByAnotherApp(
        new Error(
          "One or more domains requested are already associated with another Amplify app: omnichannel.telcoredsas.com"
        )
      )
    ).toBe(true);
    expect(isDomainTakenByAnotherApp(new Error("Failed to create Amplify domain association"))).toBe(
      false
    );
  });
});

describe("ensureResellerDomainInAmplify", () => {
  const originalAppId = process.env.AMPLIFY_APP_ID;
  const originalBranch = process.env.AMPLIFY_BRANCH_NAME;

  beforeEach(() => {
    mockSend.mockReset();
    process.env.AMPLIFY_APP_ID = "app-current";
    process.env.AMPLIFY_BRANCH_NAME = "main";
  });

  afterEach(() => {
    if (originalAppId === undefined) delete process.env.AMPLIFY_APP_ID;
    else process.env.AMPLIFY_APP_ID = originalAppId;
    if (originalBranch === undefined) delete process.env.AMPLIFY_BRANCH_NAME;
    else process.env.AMPLIFY_BRANCH_NAME = originalBranch;
  });

  function notFound(): Error {
    return Object.assign(new Error("Domain association not found"), { name: "NotFoundException" });
  }

  function association(domainName: string, prefix: string) {
    return {
      domainAssociation: {
        domainName,
        domainStatus: "PENDING_VERIFICATION",
        enableAutoSubDomain: false,
        subDomains: [
          {
            verified: false,
            dnsRecord: `${prefix || "@"} CNAME d111.cloudfront.net`,
            subDomainSetting: { prefix, branchName: "main" },
          },
        ],
      },
    };
  }

  it("creates the association when the current app does not have it", async () => {
    mockSend.mockImplementation(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name === "GetDomainAssociationCommand") throw notFound();
      if (command.constructor.name === "CreateDomainAssociationCommand") {
        return association("telcoredsas.com", "omnichannel");
      }
      throw new Error(`unexpected ${command.constructor.name}`);
    });

    const dns = await ensureResellerDomainInAmplify("omnichannel.telcoredsas.com");
    expect(dns.rootDomain).toBe("telcoredsas.com");
    expect(dns.prefix).toBe("omnichannel");
    expect(dns.cnameTarget).toBe("d111.cloudfront.net");
  });

  it("releases the domain from another app and retries create", async () => {
    let createAttempts = 0;
    mockSend.mockImplementation(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const name = command.constructor.name;
      if (name === "GetDomainAssociationCommand") {
        if (command.input.appId === "app-other" && command.input.domainName === "telcoredsas.com") {
          return association("telcoredsas.com", "omnichannel");
        }
        throw notFound();
      }
      if (name === "CreateDomainAssociationCommand") {
        createAttempts += 1;
        if (createAttempts === 1) {
          throw new Error(
            "One or more domains requested are already associated with another Amplify app: omnichannel.telcoredsas.com"
          );
        }
        return association("telcoredsas.com", "omnichannel");
      }
      if (name === "ListAppsCommand") {
        return { apps: [{ appId: "app-current", name: "chatbot-platform-prod" }, { appId: "app-other", name: "legacy" }] };
      }
      if (name === "DeleteDomainAssociationCommand") {
        expect(command.input).toEqual({ appId: "app-other", domainName: "telcoredsas.com" });
        return {};
      }
      throw new Error(`unexpected ${name}`);
    });

    const dns = await ensureResellerDomainInAmplify("omnichannel.telcoredsas.com");
    expect(dns.prefix).toBe("omnichannel");
    expect(createAttempts).toBe(2);
    expect(mockSend.mock.calls.some((call) => call[0].constructor.name === "DeleteDomainAssociationCommand")).toBe(
      true
    );
  });

  it("returns a conflict when the domain cannot be found on another app in this account", async () => {
    mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      const name = command.constructor.name;
      if (name === "GetDomainAssociationCommand") throw notFound();
      if (name === "CreateDomainAssociationCommand") {
        throw new Error(
          "One or more domains requested are already associated with another Amplify app: omnichannel.telcoredsas.com"
        );
      }
      if (name === "ListAppsCommand") {
        return { apps: [{ appId: "app-current", name: "chatbot-platform-prod" }] };
      }
      throw new Error(`unexpected ${name}`);
    });

    await expect(ensureResellerDomainInAmplify("omnichannel.telcoredsas.com")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("already associated with another Amplify app"),
    });
  });
});
