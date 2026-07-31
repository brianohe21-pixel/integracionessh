import type { MetricsReportSchedule } from "@/types";

export const DEFAULT_METRICS_REPORT_SCHEDULE: MetricsReportSchedule = {
  enabled: false,
  frequency: "weekly",
  recipients: [],
  hour: 8,
  dayOfWeek: 1,
  timezone: "UTC",
};

export function resolveMetricsReportSchedule(
  schedule?: MetricsReportSchedule | null
): MetricsReportSchedule {
  if (!schedule) return { ...DEFAULT_METRICS_REPORT_SCHEDULE };
  return {
    enabled: Boolean(schedule.enabled),
    frequency: schedule.frequency === "daily" ? "daily" : "weekly",
    recipients: Array.isArray(schedule.recipients)
      ? schedule.recipients.map((email) => email.trim()).filter(Boolean)
      : [],
    hour:
      Number.isFinite(schedule.hour) && schedule.hour >= 0 && schedule.hour <= 23
        ? schedule.hour
        : DEFAULT_METRICS_REPORT_SCHEDULE.hour,
    dayOfWeek:
      schedule.frequency === "weekly" &&
      Number.isFinite(schedule.dayOfWeek) &&
      schedule.dayOfWeek! >= 1 &&
      schedule.dayOfWeek! <= 7
        ? schedule.dayOfWeek
        : DEFAULT_METRICS_REPORT_SCHEDULE.dayOfWeek,
    timezone: schedule.timezone?.trim() || DEFAULT_METRICS_REPORT_SCHEDULE.timezone,
    ...(schedule.lastSentAt ? { lastSentAt: schedule.lastSentAt } : {}),
  };
}

export function getDefaultReportTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function parseRecipientsInput(value: string): string[] {
  return [...new Set(value.split(/[,;\n]/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function formatRecipientsInput(recipients: string[]): string {
  return recipients.join(", ");
}
