import {
  isValidTelephonySttModelId,
  parseSttModelId,
  resolveTelephonySttModel,
} from "./registry.js";

describe("stt registry", () => {
  it("parses namespaced deepgram model ids", () => {
    expect(parseSttModelId("deepgram:nova-3")).toEqual({
      provider: "deepgram",
      model: "nova-3",
    });
  });

  it("treats legacy openai ids as openai provider", () => {
    expect(parseSttModelId("gpt-4o-mini-transcribe")).toEqual({
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
    });
  });

  it("resolves deepgram model without openai native transcription", () => {
    expect(resolveTelephonySttModel("deepgram:nova-3")).toEqual({
      id: "deepgram:nova-3",
      provider: "deepgram",
      model: "nova-3",
      usesOpenAiNativeTranscription: false,
    });
  });

  it("falls back to default openai model for unknown ids", () => {
    expect(resolveTelephonySttModel("unknown-model")).toEqual({
      id: "gpt-4o-mini-transcribe",
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
      usesOpenAiNativeTranscription: true,
    });
  });

  it("validates telephony model ids", () => {
    expect(isValidTelephonySttModelId("deepgram:nova-3")).toBe(true);
    expect(isValidTelephonySttModelId("unknown-model")).toBe(false);
  });
});
