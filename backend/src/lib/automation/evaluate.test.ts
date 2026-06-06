import { normalizeText } from "./evaluate.js";

describe("normalizeText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeText("HÓLA Asesor")).toBe("hola asesor");
  });
});
