import { describe, expect, it } from "@jest/globals";
import { resolveLocalizedText } from "./resolve-localized.js";

describe("resolveLocalizedText", () => {
  it("returns plain string as-is", () => {
    expect(resolveLocalizedText("Hola", "en")).toBe("Hola");
  });

  it("returns locale-specific text from object", () => {
    expect(
      resolveLocalizedText({ es: "Hola", en: "Hello" }, "en")
    ).toBe("Hello");
  });

  it("falls back to other locale when primary is empty", () => {
    expect(
      resolveLocalizedText({ es: "Hola", en: "" }, "en")
    ).toBe("Hola");
  });

  it("returns empty string for undefined", () => {
    expect(resolveLocalizedText(undefined, "es")).toBe("");
  });
});
