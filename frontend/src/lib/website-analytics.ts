import type { WebsiteAnalyticsSettings } from "@/types";

export const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{10}$/;

export const DEFAULT_WEBSITE_ANALYTICS: WebsiteAnalyticsSettings = {
  enabled: false,
};

export function isValidGaMeasurementId(value: string): boolean {
  return GA_MEASUREMENT_ID_PATTERN.test(value.trim().toUpperCase());
}

export function normalizeGaMeasurementId(value: string): string {
  return value.trim().toUpperCase();
}

export function resolveWebsiteAnalyticsSettings(
  settings?: WebsiteAnalyticsSettings | null
): WebsiteAnalyticsSettings {
  const enabled = Boolean(settings?.enabled);
  const measurementId = settings?.googleAnalyticsMeasurementId?.trim();

  if (!enabled || !measurementId || !isValidGaMeasurementId(measurementId)) {
    return { enabled: false };
  }

  return {
    enabled: true,
    googleAnalyticsMeasurementId: normalizeGaMeasurementId(measurementId),
  };
}
