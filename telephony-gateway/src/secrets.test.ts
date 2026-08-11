const secretStore = new Map<string, string>();
const tenantParents = new Map<string, string | null>();

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  GetCommand: class {
    input: { TableName: string; Key: Record<string, string> };
    constructor(input: { TableName: string; Key: Record<string, string> }) {
      this.input = input;
    }
  },
}));

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(async (command: { input?: { SecretId?: string } }) => {
      const secretId = command.input?.SecretId;
      const value = secretId ? secretStore.get(secretId) : undefined;
      if (!value) throw new Error("not found");
      return { SecretString: value };
    }),
  })),
  GetSecretValueCommand: class {
    input: { SecretId: string };
    constructor(input: { SecretId: string }) {
      this.input = input;
    }
  },
}));

jest.mock("./dynamo.js", () => ({
  docClient: {
    send: jest.fn(async (command: { input: { Key: { PK: string } } }) => {
      const tenantId = command.input.Key.PK.replace("TENANT#", "");
      const parentTenantId = tenantParents.get(tenantId);
      if (parentTenantId === undefined) return { Item: undefined };
      return {
        Item: parentTenantId ? { parentTenantId } : {},
      };
    }),
  },
  tableName: "test-table",
}));

import { getElevenLabsApiKey, getOpenAIApiKey } from "./secrets.js";

describe("telephony gateway credential resolution", () => {
  beforeEach(() => {
    secretStore.clear();
    tenantParents.clear();
    tenantParents.set("sub-1", "reseller-1");
    tenantParents.set("reseller-1", null);
    process.env.ENVIRONMENT = "test";
  });

  it("inherits OpenAI key from reseller parent", async () => {
    secretStore.set(
      "/test/tenants/reseller-1/openai",
      JSON.stringify({ apiKey: "sk-reseller" })
    );

    await expect(getOpenAIApiKey("sub-1")).resolves.toBe("sk-reseller");
  });

  it("inherits ElevenLabs key from platform fallback", async () => {
    secretStore.set(
      "/test/platform/elevenlabs",
      JSON.stringify({ apiKey: "el-platform" })
    );

    await expect(getElevenLabsApiKey("sub-1")).resolves.toBe("el-platform");
  });
});
