import { normalizePhoneWithCountryCode, stripPhoneDigits } from "./normalize.js";

describe("normalizePhoneWithCountryCode", () => {
  it("prepends Colombia code for 10-digit local mobile", () => {
    expect(normalizePhoneWithCountryCode("3223117078")).toBe("573223117078");
    expect(normalizePhoneWithCountryCode("300 123 4567")).toBe("573001234567");
  });

  it("keeps numbers that already include country code", () => {
    expect(normalizePhoneWithCountryCode("573223117078")).toBe("573223117078");
    expect(normalizePhoneWithCountryCode("+57 322 311 7078")).toBe("573223117078");
  });

  it("strips leading zeros before normalizing", () => {
    expect(normalizePhoneWithCountryCode("03223117078")).toBe("573223117078");
  });

  it("does not prepend for longer international numbers", () => {
    expect(normalizePhoneWithCountryCode("14155552671")).toBe("14155552671");
  });
});

describe("stripPhoneDigits", () => {
  it("removes non-digits and leading zeros", () => {
    expect(stripPhoneDigits("+57 (322) 311-7078")).toBe("573223117078");
    expect(stripPhoneDigits("03223117078")).toBe("3223117078");
  });
});
