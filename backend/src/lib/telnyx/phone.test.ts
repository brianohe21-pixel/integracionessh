import { isValidE164, normalizeE164 } from "./phone.js";

describe("telnyx phone", () => {
  it("normalizes US 10-digit numbers", () => {
    expect(normalizeE164("5551234567")).toBe("+15551234567");
  });

  it("keeps valid E.164 numbers", () => {
    expect(normalizeE164("+573001234567")).toBe("+573001234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeE164("abc")).toBe("");
    expect(isValidE164("123")).toBe(false);
  });
});
