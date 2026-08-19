import {
  buildDemoToolResponse,
  isDemoModeEnabled,
  shouldUseDemoFallback,
} from "./voice-http-demo-fallback.js";

describe("voice-http-demo-fallback", () => {
  it("detects demo mode flag", () => {
    expect(isDemoModeEnabled({ demo_mode: "true" })).toBe(true);
    expect(isDemoModeEnabled({ demo_mode: "false" })).toBe(false);
  });

  it("falls back on API errors in demo mode", () => {
    expect(
      shouldUseDemoFallback(true, false, { success: false, error: "company not found" }, "create_offer")
    ).toBe(true);
    expect(
      shouldUseDemoFallback(true, true, { success: true, data: [] }, "autocomplete_street")
    ).toBe(true);
    expect(shouldUseDemoFallback(false, false, { success: false }, "create_offer")).toBe(false);
  });

  it("builds demo offer and trip payloads for Lima", () => {
    const variables = {
      default_city: "Lima",
      default_country: "Perú",
      default_phone_country_code: "51",
      default_currency: "PEN",
    };
    const offer = buildDemoToolResponse("create_offer", { customer_id: "c1" }, variables);
    const trip = buildDemoToolResponse("create_trip", { offer_id: "o1" }, variables);
    const autocomplete = buildDemoToolResponse("autocomplete_street", { q: "Plaza Vea" }, variables);
    expect(offer.demo).toBe(true);
    expect((offer.data as { offers: Array<{ currency: string }> }).offers[0].currency).toBe("PEN");
    expect(trip.demo).toBe(true);
    expect(
      (autocomplete.data as Array<{ secondary_text: string }>)[0].secondary_text
    ).toBe("Lima");
    expect((autocomplete.data as unknown[]).length).toBe(1);
  });
});
