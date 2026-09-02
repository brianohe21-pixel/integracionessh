import {
  DEFAULT_REALTIME_MODEL_ID,
  isValidRealtimeModelId,
  isValidTelephonyAssistantModelId,
  REALTIME_MODELS,
  resolveRealtimeModelId,
} from "./realtime-models.js";

describe("realtime models registry", () => {
  it("includes current OpenAI realtime models", () => {
    expect(REALTIME_MODELS.map((model) => model.id)).toEqual(
      expect.arrayContaining([
        "gpt-realtime-2.1-mini",
        "gpt-realtime-2.1",
        "gpt-realtime-2",
        "gpt-realtime-1.5",
        "gpt-realtime",
        "gpt-realtime-mini",
      ])
    );
  });

  it("resolves known and legacy realtime model ids", () => {
    expect(resolveRealtimeModelId(undefined)).toBe(DEFAULT_REALTIME_MODEL_ID);
    expect(resolveRealtimeModelId("gpt-realtime-2")).toBe("gpt-realtime-2");
    expect(resolveRealtimeModelId("gpt-realtime-2.1-2026-02-01")).toBe(
      "gpt-realtime-2.1-2026-02-01"
    );
    expect(resolveRealtimeModelId("gpt-4.1-mini")).toBe("gpt-4.1-mini");
    expect(resolveRealtimeModelId("invalid")).toBe(DEFAULT_REALTIME_MODEL_ID);
    expect(isValidRealtimeModelId("gpt-realtime-2.1")).toBe(true);
    expect(isValidRealtimeModelId("gpt-4o")).toBe(false);
    expect(isValidTelephonyAssistantModelId("gpt-4o")).toBe(true);
  });
});
