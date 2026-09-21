import {
  attributionFromFormAttribution,
  attributionFromLeadAds,
  attributionFromWhatsAppReferral,
  isAdReferral,
} from "./attribution.js";

describe("meta-ads attribution", () => {
  it("detects ad referral from ctwa clid", () => {
    expect(isAdReferral({ ctwa_clid: "abc123" })).toBe(true);
  });

  it("detects ad referral from source type", () => {
    expect(isAdReferral({ source_type: "ad", source_id: "123" })).toBe(true);
  });

  it("maps whatsapp referral to ads attribution", () => {
    expect(
      attributionFromWhatsAppReferral({
        source_type: "ad",
        source_id: "ad-1",
        source_url: "https://fb.me/abc",
        headline: "Promo",
        ctwa_clid: "clid-1",
      })
    ).toEqual({
      source: "meta_ctwa",
      adSourceId: "ad-1",
      adId: "ad-1",
      ctwaClid: "clid-1",
      headline: "Promo",
      sourceUrl: "https://fb.me/abc",
      sourceType: "ad",
    });
  });

  it("maps form attribution with utm", () => {
    expect(
      attributionFromFormAttribution(
        {
          utmSource: "facebook",
          utmCampaign: "spring",
        },
        "sub-1"
      )
    ).toEqual({
      source: "utm",
      submissionId: "sub-1",
      utmSource: "facebook",
      utmCampaign: "spring",
    });
  });

  it("maps lead ads attribution", () => {
    expect(
      attributionFromLeadAds({
        adId: "ad-9",
        adSetId: "set-1",
        formId: "form-1",
        leadgenId: "leadgen-1",
      })
    ).toEqual({
      source: "meta_lead_ads",
      adId: "ad-9",
      adSourceId: "ad-9",
      adSetId: "set-1",
      formId: "form-1",
      submissionId: "leadgen-1",
    });
  });
});
