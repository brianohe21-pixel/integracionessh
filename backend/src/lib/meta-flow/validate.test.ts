import { validateMetaFlowJson } from "./validate.js";

describe("validateMetaFlowJson", () => {
  it("accepts valid flow json", () => {
    const json = validateMetaFlowJson({
      version: "7.0",
      screens: [{ id: "S1" }],
    });
    expect(json.version).toBe("7.0");
  });

  it("rejects missing screens", () => {
    expect(() => validateMetaFlowJson({ version: "7.0" })).toThrow();
  });
});
