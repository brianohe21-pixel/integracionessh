import type { ShortLinkUtm } from "../../types/index.js";

const UTM_PARAM_MAP: Array<[string, keyof ShortLinkUtm]> = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
  ["utm_term", "utmTerm"],
];

export function buildRedirectUrl(
  destinationUrl: string,
  linkUtm: ShortLinkUtm,
  clickQuery?: Record<string, string>
): string {
  const url = new URL(destinationUrl);

  for (const [param, key] of UTM_PARAM_MAP) {
    const clickValue = clickQuery?.[param];
    if (clickValue) {
      url.searchParams.set(param, clickValue);
      continue;
    }
    const linkValue = linkUtm[key];
    if (linkValue && !url.searchParams.has(param)) {
      url.searchParams.set(param, linkValue);
    }
  }

  if (clickQuery) {
    for (const [key, value] of Object.entries(clickQuery)) {
      if (key.startsWith("utm_") || url.searchParams.has(key)) continue;
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export function extractUtmQuery(query: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [param] of UTM_PARAM_MAP) {
    const value = query[param];
    if (value) result[param] = value;
  }
  return result;
}
