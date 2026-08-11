import {
  normalizeElevenLabsPayload,
  normalizeOpenAIPayload,
  normalizeTelnyxPayload,
} from "./provider-credentials.validation.js";

describe("provider credential validation", () => {
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
  });

  it("rejects Telnyx payload without connectionId", () => {
    expect(() => normalizeTelnyxPayload({ apiKey: "KEY1234567890" })).toThrow(
      "Telnyx connectionId is required"
    );
  });

  it("normalizes ElevenLabs payload", () => {
    expect(normalizeElevenLabsPayload({ apiKey: "el-key-1234567890" })).toEqual({
      apiKey: "el-key-1234567890",
    });
  });
});
