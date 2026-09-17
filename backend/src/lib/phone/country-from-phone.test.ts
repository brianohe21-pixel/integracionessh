import { detectCountryFromPhone, resolveContactCountry } from "./country-from-phone.js";

describe("detectCountryFromPhone", () => {
  it("detects Colombia from full international number", () => {
    expect(detectCountryFromPhone("+57 322 311 7078")).toBe("Colombia");
    expect(detectCountryFromPhone("573223117078")).toBe("Colombia");
  });

  it("detects Colombia from local 10-digit number", () => {
    expect(detectCountryFromPhone("3223117078")).toBe("Colombia");
  });

  it("detects other countries from their calling codes", () => {
    expect(detectCountryFromPhone("+52 55 1234 5678")).toBe("México");
    expect(detectCountryFromPhone("51987654321")).toBe("Perú");
    expect(detectCountryFromPhone("14155552671")).toBe("Estados Unidos");
    expect(detectCountryFromPhone("+34 612 34 56 78")).toBe("España");
  });

  it("returns undefined for numbers that are too short", () => {
    expect(detectCountryFromPhone("12345")).toBeUndefined();
  });
});

describe("resolveContactCountry", () => {
  it("prefers an explicit country when provided", () => {
    expect(resolveContactCountry("573223117078", "Chile")).toBe("Chile");
  });

  it("falls back to phone detection when country is empty", () => {
    expect(resolveContactCountry("573223117078", "")).toBe("Colombia");
    expect(resolveContactCountry("573223117078")).toBe("Colombia");
  });
});
