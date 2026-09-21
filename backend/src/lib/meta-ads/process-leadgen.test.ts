import { extractLeadAdsFieldValues } from "./ads-lead.js";
import { attributionFromLeadAds } from "./attribution.js";

describe("process leadgen helpers", () => {
  it("extracts common lead form fields", () => {
    expect(
      extractLeadAdsFieldValues([
        { name: "full_name", values: ["Ana Lopez"] },
        { name: "email", values: ["ana@example.com"] },
        { name: "phone_number", values: ["+573001112233"] },
        { name: "city", values: ["Bogota"] },
      ])
    ).toEqual({
      phone: "+573001112233",
      name: "Ana Lopez",
      email: "ana@example.com",
      notes: ["city: Bogota"],
    });
  });

  it("builds lead ads attribution from webhook values", () => {
    expect(
      attributionFromLeadAds({
        adId: "ad-1",
        adSetId: "set-1",
        formId: "form-1",
        leadgenId: "leadgen-1",
      }).source
    ).toBe("meta_lead_ads");
  });
});
