import { describe, expect, it } from "@jest/globals";
import { extractPhoneFromShopifyPayload, normalizeShopifyPhone } from "./phone.js";

describe("shopify phone", () => {
  it("normalizes local Colombian numbers with default country", () => {
    expect(normalizeShopifyPhone("3001234567", "CO")).toBe("573001234567");
  });

  it("keeps E.164 digits when plus prefix is present", () => {
    expect(normalizeShopifyPhone("+52 55 1234 5678", "MX")).toBe("525512345678");
  });

  it("extracts shipping phone before billing", () => {
    const result = extractPhoneFromShopifyPayload(
      {
        shipping_address: {
          phone: "3001112233",
          country_code: "CO",
          name: "Ana",
        },
        billing_address: {
          phone: "3009998877",
          country_code: "CO",
        },
      },
      "CO"
    );
    expect(result.phone).toBe("573001112233");
    expect(result.name).toBe("Ana");
  });
});
