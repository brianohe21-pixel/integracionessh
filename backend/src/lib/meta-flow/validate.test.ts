import {
  formatMetaValidationErrors,
  normalizeMetaFlowJson,
  validateMetaFlowJson,
} from "./validate.js";

describe("validateMetaFlowJson", () => {
  it("accepts valid flow json", () => {
    const json = validateMetaFlowJson({
      version: "7.3",
      screens: [{ id: "S1", terminal: true }],
    });
    expect(json.version).toBe("7.3");
    expect((json.screens as Array<Record<string, unknown>>)[0]?.data).toEqual({});
    expect((json.screens as Array<Record<string, unknown>>)[0]?.success).toBe(true);
  });

  it("rejects missing screens", () => {
    expect(() => validateMetaFlowJson({ version: "7.3" })).toThrow();
  });

  it("normalizes input_type to input-type", () => {
    const json = normalizeMetaFlowJson({
      version: "7.0",
      screens: [
        {
          id: "S1",
          layout: {
            type: "SingleColumnLayout",
            children: [
              {
                type: "TextInput",
                name: "email",
                input_type: "EMAIL",
              },
            ],
          },
        },
      ],
    });
    const child = (
      (json.screens as Array<Record<string, unknown>>)[0]?.layout as {
        children?: Array<Record<string, unknown>>;
      }
    )?.children?.[0];
    expect(child?.["input-type"]).toBe("email");
    expect(child?.input_type).toBeUndefined();
  });

  it("formats validation errors", () => {
    expect(
      formatMetaValidationErrors([
        { path: "screens[0].layout", message: "Invalid property" },
      ])
    ).toContain("screens[0].layout");
  });
});
