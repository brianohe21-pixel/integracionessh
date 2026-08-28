import {
  DEFAULT_MODEL_ID,
  getModelsForPlan,
  isModelAllowedForPlan,
  isValidModelId,
  resolveModelId,
} from "./models.js";

describe("ai models registry", () => {
  it("includes legacy and new OpenAI models", () => {
    expect(isValidModelId("gpt-4.1-mini")).toBe(true);
    expect(isValidModelId("gpt-4o-mini")).toBe(true);
    expect(isValidModelId("gpt-4.1")).toBe(true);
    expect(isValidModelId("gpt-5-nano")).toBe(true);
    expect(isValidModelId("gpt-5")).toBe(true);
    expect(isValidModelId("gpt-5.1")).toBe(true);
    expect(isValidModelId("gpt-5.2")).toBe(true);
    expect(isValidModelId("gpt-5.2-pro")).toBe(true);
    expect(isValidModelId("gpt-5.6")).toBe(true);
    expect(isValidModelId("gpt-5.6-sol")).toBe(true);
    expect(isValidModelId("o3-mini")).toBe(true);
    expect(isValidModelId("o3")).toBe(true);
    expect(isValidModelId("unknown-model")).toBe(false);
  });

  it("defaults to gpt-4.1-mini", () => {
    expect(DEFAULT_MODEL_ID).toBe("gpt-4.1-mini");
    expect(resolveModelId(undefined)).toBe("gpt-4.1-mini");
    expect(resolveModelId("gpt-4o")).toBe("gpt-4o");
    expect(resolveModelId("gpt-5.6-terra")).toBe("gpt-5.6-terra");
    expect(resolveModelId("invalid")).toBe("gpt-4.1-mini");
  });

  it("restricts economy models to free and pro plans", () => {
    const freeModels = getModelsForPlan("free").map((model) => model.id);
    const proModels = getModelsForPlan("pro").map((model) => model.id);
    const scaleModels = getModelsForPlan("scale").map((model) => model.id);

    expect(freeModels).toEqual(
      expect.arrayContaining(["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1-nano", "gpt-5-nano"])
    );
    expect(proModels).toEqual(
      expect.arrayContaining(["gpt-4.1-mini", "gpt-5-mini", "gpt-5.6-luna"])
    );
    expect(scaleModels).toEqual(
      expect.arrayContaining([
        "gpt-4.1",
        "gpt-4o",
        "gpt-5",
        "gpt-5.1",
        "gpt-5.2",
        "gpt-5.2-pro",
        "gpt-5.6",
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "o3-mini",
        "o4-mini",
        "o3",
        "o4",
        "gpt-4-turbo",
      ])
    );
    expect(getModelsForPlan("enterprise").map((model) => model.id)).toEqual(scaleModels);
    expect(isModelAllowedForPlan("free", "gpt-4.1-mini")).toBe(true);
    expect(isModelAllowedForPlan("free", "gpt-5-mini")).toBe(false);
    expect(isModelAllowedForPlan("pro", "gpt-5-mini")).toBe(true);
    expect(isModelAllowedForPlan("free", "gpt-4.1")).toBe(false);
    expect(isModelAllowedForPlan("scale", "gpt-5.6-sol")).toBe(true);
    expect(isModelAllowedForPlan("enterprise", "gpt-5.6-sol")).toBe(true);
  });
});
