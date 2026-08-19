const secretStore = new Map<string, string>();
const tenantParents = new Map<string, string | null>();

jest.mock("@aws-sdk/client-secrets-manager", () => {
  class ResourceNotFoundException extends Error {}
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(async (command: { input?: { SecretId?: string; SecretString?: string } }) => {
        const secretId = command.input?.SecretId;
        if (!secretId) return {};
        if (command.constructor.name === "GetSecretValueCommand") {
          const value = secretStore.get(secretId);
          if (!value) throw new ResourceNotFoundException("not found");
          return { SecretString: value };
        }
        if (command.constructor.name === "PutSecretValueCommand") {
          secretStore.set(secretId, command.input?.SecretString ?? "");
          return {};
        }
        if (command.constructor.name === "CreateSecretCommand") {
          secretStore.set(secretId, command.input?.SecretString ?? "");
          return {};
        }
        if (command.constructor.name === "DeleteSecretCommand") {
          secretStore.delete(secretId);
          return {};
        }
        return {};
      }),
    })),
    GetSecretValueCommand: class {
      input: { SecretId: string };
      constructor(input: { SecretId: string }) {
        this.input = input;
      }
    },
    PutSecretValueCommand: class {
      input: { SecretId: string; SecretString: string };
      constructor(input: { SecretId: string; SecretString: string }) {
        this.input = input;
      }
    },
    CreateSecretCommand: class {
      input: { SecretId: string; SecretString: string };
      constructor(input: { SecretId: string; SecretString: string }) {
        this.input = input;
      }
    },
    DeleteSecretCommand: class {
      input: { SecretId: string };
      constructor(input: { SecretId: string }) {
        this.input = input;
      }
    },
    ResourceNotFoundException,
  };
});

jest.mock("../dynamodb/tenant.repository.js", () => ({
  getTenant: jest.fn(async (tenantId: string) => {
    const parentTenantId = tenantParents.get(tenantId);
    if (parentTenantId === undefined) return null;
    return parentTenantId ? { tenantId, parentTenantId } : { tenantId };
  }),
}));

import {
  deleteTenantProviderCredential,
  getProviderCredentialStatuses,
  hasTenantProviderCredential,
  resolveProviderCredential,
  saveTenantProviderCredential,
} from "./provider-credentials.js";

const ENV = "test";

describe("provider credentials resolution", () => {
  beforeEach(() => {
    secretStore.clear();
    tenantParents.clear();
    tenantParents.set("sub-1", "reseller-1");
    tenantParents.set("reseller-1", null);
    tenantParents.set("standalone", null);
  });

  it("resolves own tenant credential first", async () => {
    secretStore.set(
      `/${ENV}/tenants/sub-1/openai`,
      JSON.stringify({ apiKey: "sk-own" })
    );
    secretStore.set(
      `/${ENV}/tenants/reseller-1/openai`,
      JSON.stringify({ apiKey: "sk-reseller" })
    );

    const resolved = await resolveProviderCredential("sub-1", ENV, "openai");
    expect(resolved).toEqual({
      payload: { apiKey: "sk-own" },
      source: "own",
      ownerTenantId: "sub-1",
    });
  });

  it("falls back to reseller credential", async () => {
    secretStore.set(
      `/${ENV}/tenants/reseller-1/openai`,
      JSON.stringify({ apiKey: "sk-reseller" })
    );

    const resolved = await resolveProviderCredential("sub-1", ENV, "openai");
    expect(resolved).toEqual({
      payload: { apiKey: "sk-reseller" },
      source: "reseller",
      ownerTenantId: "reseller-1",
    });
  });

  it("falls back to platform credential", async () => {
    secretStore.set(
      `/${ENV}/platform/openai`,
      JSON.stringify({ apiKey: "sk-platform" })
    );

    const resolved = await resolveProviderCredential("sub-1", ENV, "openai");
    expect(resolved).toEqual({
      payload: { apiKey: "sk-platform" },
      source: "platform",
      ownerTenantId: "platform",
    });
  });

  it("reports credential statuses with inheritance source", async () => {
    secretStore.set(
      `/${ENV}/tenants/reseller-1/telnyx`,
      JSON.stringify({ apiKey: "t-key", connectionId: "conn-1" })
    );

    const statuses = await getProviderCredentialStatuses("sub-1", ENV, "https://api.example.com");
    const telnyx = statuses.find((item) => item.provider === "telnyx");
    expect(telnyx).toMatchObject({
      configured: true,
      source: "reseller",
      ownerTenantId: "reseller-1",
      webhookUrl: "https://api.example.com/telephony/webhook/reseller-1",
    });
  });

  it("saves and deletes own credentials", async () => {
    await saveTenantProviderCredential("reseller-1", ENV, "elevenlabs", {
      apiKey: "el-key",
    });
    expect(await hasTenantProviderCredential("reseller-1", ENV, "elevenlabs")).toBe(true);
    await deleteTenantProviderCredential("reseller-1", ENV, "elevenlabs");
    expect(await hasTenantProviderCredential("reseller-1", ENV, "elevenlabs")).toBe(false);
  });
});
