import type { AdsAttribution, AdsAttributionSource, Conversation, Lead } from "@/types";

export function isMetaAdsAttribution(attribution?: AdsAttribution): boolean {
  return attribution?.source === "meta_ctwa" || attribution?.source === "meta_lead_ads";
}

export function conversationHasMetaAdsAttribution(conversation: Conversation): boolean {
  return isMetaAdsAttribution(conversation.attribution);
}

export function leadHasMetaAdsAttribution(lead: Lead): boolean {
  return (
    isMetaAdsAttribution(lead.attribution) ||
    lead.metaFlowId === "meta_ctwa" ||
    lead.metaFlowId === "meta_lead_ads" ||
    lead.tags.includes("meta_ads")
  );
}

export function adsAttributionLabelKey(source?: AdsAttributionSource): string {
  if (source === "meta_ctwa") return "ads.sourceCtwa";
  if (source === "meta_lead_ads") return "ads.sourceLeadAds";
  if (source === "utm") return "ads.sourceUtm";
  if (source === "web_form") return "ads.sourceWebForm";
  return "ads.sourceUnknown";
}

export function adsAttributionSummary(attribution?: AdsAttribution): string {
  if (!attribution) return "";
  if (attribution.utmCampaign) return attribution.utmCampaign;
  if (attribution.headline) return attribution.headline;
  if (attribution.adId) return attribution.adId;
  if (attribution.adSourceId) return attribution.adSourceId;
  if (attribution.formId) return attribution.formId;
  return attribution.source;
}
