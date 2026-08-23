import {
  normalizeDeepgramPayload,
  normalizeElevenLabsPayload,
  normalizeOpenAIPayload,
  normalizeTelnyxPayload,
  validateProviderCredential,
} from "./provider-credentials.validation.js";

describe("provider credential validation", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("normalizes OpenAI payload", () => {
    expect(normalizeOpenAIPayload({ apiKey: "sk-test-key-1234567890" })).toEqual({
      apiKey: "sk-test-key-1234567890",
    });
  });

  it("rejects invalid OpenAI payload", () => {
    expect(() => normalizeOpenAIPayload({ apiKey: "bad" })).toThrow("Invalid OpenAI API key format");
  });

  it("normalizes Telnyx payload", () => {
    expect(
      normalizeTelnyxPayload({
        apiKey: "KEY1234567890",
        connectionId: "conn-1",
        publicKey: "pub-key",
      })
    ).toEqual({
      apiKey: "KEY1234567890",
      connectionId: "conn-1",
      publicKey: "pub-key",
    });
    expect(normalizeTelnyxPayload({ apiKey: "KEY1234567890" })).toEqual({
      apiKey: "KEY1234567890",
    });
  });

  it("rejects Telnyx payload without apiKey", () => {
    expect(() => normalizeTelnyxPayload({ connectionId: "conn-1" })).toThrow(
      "Telnyx apiKey is required"
    );
  });

  it("normalizes ElevenLabs payload", () => {
    expect(normalizeElevenLabsPayload({ apiKey: "el-key-1234567890" })).toEqual({
      apiKey: "el-key-1234567890",
    });
  });

  it("normalizes Deepgram payload", () => {
    expect(normalizeDeepgramPayload({ apiKey: "dg-key-1234567890" })).toEqual({
      apiKey: "dg-key-1234567890",
    });
  });

  it("accepts Deepgram key when projects endpoint succeeds", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: [] }),
    }) as unknown as typeof fetch;

    await expect(
      validateProviderCredential("deepgram", { apiKey: "dg-key-1234567890" })
    ).resolves.toBeUndefined();
  });

  it("accepts ElevenLabs key when voices endpoint succeeds", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: { status: "forbidden" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ voices: [] }),
      }) as unknown as typeof fetch;

    await expect(
      validateProviderCredential("elevenlabs", { apiKey: "el-key-1234567890" })
    ).resolves.toBeUndefined();
  });

  it("accepts ElevenLabs key when quota is exceeded", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: { status: "quota_exceeded" } }),
    }) as unknown as typeof fetch;

    await expect(
      validateProviderCredential("elevenlabs", { apiKey: "el-key-1234567890" })
    ).resolves.toBeUndefined();
  });

  it("rejects ElevenLabs key blocked by IP allowlist", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ detail: { status: "forbidden" } }),
    }) as unknown as typeof fetch;

    await expect(
      validateProviderCredential("elevenlabs", { apiKey: "el-key-1234567890" })
    ).rejects.toMatchObject({
      message: expect.stringContaining("IP allowlist"),
    });
  });
});
