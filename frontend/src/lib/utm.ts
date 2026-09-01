export interface FormAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  shortLinkId?: string;
  shortLinkSlug?: string;
}

const STORAGE_KEY = "ssh_attribution";

export function captureAttributionFromUrl(): FormAttribution | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const attribution: FormAttribution = {
    landingPage: window.location.href,
    referrer: document.referrer || undefined,
  };

  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  const utmContent = params.get("utm_content");
  const utmTerm = params.get("utm_term");

  if (utmSource) attribution.utmSource = utmSource;
  if (utmMedium) attribution.utmMedium = utmMedium;
  if (utmCampaign) attribution.utmCampaign = utmCampaign;
  if (utmContent) attribution.utmContent = utmContent;
  if (utmTerm) attribution.utmTerm = utmTerm;

  const hasUtm = Boolean(utmSource || utmMedium || utmCampaign || utmContent || utmTerm);
  if (!hasUtm && !attribution.referrer) return null;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    return attribution;
  }

  return attribution;
}

export function getStoredAttribution(): FormAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormAttribution;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeAttribution(extra?: FormAttribution): FormAttribution | undefined {
  const stored = getStoredAttribution();
  if (!stored && !extra) return undefined;
  return { ...stored, ...extra };
}
