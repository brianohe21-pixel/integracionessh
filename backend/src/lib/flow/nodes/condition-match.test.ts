import { evaluateConditionMatch } from "./condition-match.js";

describe("evaluateConditionMatch", () => {
  it("supports contains, equals and not_equals", () => {
    expect(evaluateConditionMatch("Hola Mundo", "contains", "mundo")).toBe(true);
    expect(evaluateConditionMatch("Demo", "equals", "demo")).toBe(true);
    expect(evaluateConditionMatch("Demo", "not_equals", "otro")).toBe(true);
  });

  it("matches document-like patterns", () => {
    expect(evaluateConditionMatch("1020304050", "matches", "^\\d{6,10}$")).toBe(true);
    expect(evaluateConditionMatch("1020", "matches", "^\\d{6,10}$")).toBe(false);
    expect(evaluateConditionMatch("10.203.040", "matches", "^\\d{6,10}$")).toBe(false);
    expect(evaluateConditionMatch("abc", "matches", "^\\d{6,10}$")).toBe(false);
  });

  it("supports not_matches", () => {
    expect(evaluateConditionMatch("abc", "not_matches", "^\\d+$")).toBe(true);
    expect(evaluateConditionMatch("123", "not_matches", "^\\d+$")).toBe(false);
  });

  it("returns false for invalid regex", () => {
    expect(evaluateConditionMatch("123", "matches", "(")).toBe(false);
  });

  it("trims source before regex match", () => {
    expect(evaluateConditionMatch("  1234567  ", "matches", "^\\d{6,10}$")).toBe(true);
  });
});
