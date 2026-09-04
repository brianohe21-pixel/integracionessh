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
  deleteTenantMetaAppCredential,
  getMetaAppConfigStatus,
  metaWebhookUrl,
  resolveMetaAppCredential,
  saveTenantMetaAppCredential,
} from "./meta-app-credentials.js";
import { normalizeMetaAppPayload } from "./meta-app-credentials.validation.js";

const ENV = "test";
const API_BASE = "https://api.example.com";

const resellerPayload = {
  appId: "111222333",
  appSecret: "reseller-secret-123456",
  embeddedSignupConfigId: "cfg-reseller",
  webhookVerifyToken: "verify-reseller-token",
};

describe("meta app credentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    secretStore.clear();
    tenantParents.clear();
    process.env = {
      ...originalEnv,
      META_APP_ID: "999888777",
      META_APP_SECRET: "platform-secret-123456",
      WHATSAPP_VERIFY_TOKEN: "platform-verify",
      META_EMBEDDED_SIGNUP_CONFIG_ID: "cfg-platform",
    };
    tenantParents.set("reseller-1", null);
    tenantParents.set("sub-1", "reseller-1");
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("resolves own reseller credentials", async () => {
    await saveTenantMetaAppCredential("reseller-1", ENV, resellerPayload);
    const resolved = await resolveMetaAppCredential("reseller-1", ENV);
    expect(resolved?.source).toBe("own");
    expect(resolved?.ownerTenantId).toBe("reseller-1");
    expect(resolved?.payload.appId).toBe("111222333");
  });

  it("subaccount inherits reseller credentials", async () => {
    await saveTenantMetaAppCredential("reseller-1", ENV, resellerPayload);
    const resolved = await resolveMetaAppCredential("sub-1", ENV);
    expect(resolved?.source).toBe("reseller");
    expect(resolved?.ownerTenantId).toBe("reseller-1");
  });

  it("falls back to platform env when no tenant credential exists", async () => {
    const resolved = await resolveMetaAppCredential("sub-1", ENV);
    expect(resolved?.source).toBe("platform");
    expect(resolved?.payload.appId).toBe("999888777");
  });

  it("returns public status without app secret", async () => {
    await saveTenantMetaAppCredential("reseller-1", ENV, resellerPayload);
    const status = await getMetaAppConfigStatus("reseller-1", ENV, API_BASE);
    expect(status.configured).toBe(true);
    expect(status.source).toBe("own");
    expect(status.webhookUrl).toBe(metaWebhookUrl("reseller-1", API_BASE));
    expect(status).not.toHaveProperty("appSecret");
  });

  it("delete restores platform fallback status", async () => {
    await saveTenantMetaAppCredential("reseller-1", ENV, resellerPayload);
    await deleteTenantMetaAppCredential("reseller-1", ENV);
    const status = await getMetaAppConfigStatus("reseller-1", ENV, API_BASE);
    expect(status.source).toBe("platform");
    expect(status.appId).toBe("999888777");
  });

  it("validates meta app payload", () => {
    const payload = normalizeMetaAppPayload({
      appId: "12345",
      appSecret: "abcdefghijklmnop",
      embeddedSignupConfigId: "cfg-1",
    });
    expect(payload.appId).toBe("12345");
    expect(payload.webhookVerifyToken).toHaveLength(48);
  });
});
