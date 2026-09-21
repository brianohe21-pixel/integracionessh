import type { AdsAttribution, FormAttribution, WhatsAppReferral } from "../../types/index.js";

const AD_SOURCE_TYPES = new Set(["ad", "post"]);

export function isAdReferral(referral?: WhatsAppReferral): boolean {
  if (!referral) return false;
  if (referral.ctwa_clid) return true;
  if (referral.source_type && AD_SOURCE_TYPES.has(referral.source_type)) return true;
  return Boolean(referral.source_id || referral.source_url);
}

export function attributionFromWhatsAppReferral(referral: WhatsAppReferral): AdsAttribution {
  return {
    source: "meta_ctwa",
    ...(referral.source_id ? { adSourceId: referral.source_id, adId: referral.source_id } : {}),
    ...(referral.ctwa_clid ? { ctwaClid: referral.ctwa_clid } : {}),
    ...(referral.headline ? { headline: referral.headline } : {}),
    ...(referral.body ? { body: referral.body } : {}),
    ...(referral.source_url ? { sourceUrl: referral.source_url } : {}),
    ...(referral.source_type ? { sourceType: referral.source_type } : {}),
    ...(referral.media_type ? { mediaType: referral.media_type } : {}),
    ...(referral.image_url ? { imageUrl: referral.image_url } : {}),
  };
}

export function attributionFromFormAttribution(
  attribution: FormAttribution,
  submissionId?: string
): AdsAttribution {
  const hasUtm = Boolean(
    attribution.utmSource ||
      attribution.utmMedium ||
      attribution.utmCampaign ||
      attribution.utmContent ||
      attribution.utmTerm
  );

  return {
    source: hasUtm ? "utm" : "web_form",
    ...(submissionId ? { submissionId } : {}),
    ...(attribution.utmSource ? { utmSource: attribution.utmSource } : {}),
    ...(attribution.utmMedium ? { utmMedium: attribution.utmMedium } : {}),
    ...(attribution.utmCampaign ? { utmCampaign: attribution.utmCampaign } : {}),
    ...(attribution.utmContent ? { utmContent: attribution.utmContent } : {}),
    ...(attribution.utmTerm ? { utmTerm: attribution.utmTerm } : {}),
    ...(attribution.referrer ? { referrer: attribution.referrer } : {}),
    ...(attribution.landingPage ? { landingPage: attribution.landingPage } : {}),
    ...(attribution.shortLinkId ? { shortLinkId: attribution.shortLinkId } : {}),
    ...(attribution.shortLinkSlug ? { shortLinkSlug: attribution.shortLinkSlug } : {}),
  };
}

export function attributionFromLeadAds(params: {
  adId?: string;
  adSetId?: string;
  formId?: string;
  leadgenId: string;
}): AdsAttribution {
  return {
    source: "meta_lead_ads",
    ...(params.adId ? { adId: params.adId, adSourceId: params.adId } : {}),
    ...(params.adSetId ? { adSetId: params.adSetId } : {}),
    ...(params.formId ? { formId: params.formId } : {}),
    submissionId: params.leadgenId,
  };
}

export function isMetaAdsAttribution(attribution?: AdsAttribution): boolean {
  return attribution?.source === "meta_ctwa" || attribution?.source === "meta_lead_ads";
}
