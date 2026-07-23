import type { MetricsReportSchedule } from "../../types/index.js";

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

  const frequency = schedule.frequency === "daily" ? "daily" : "weekly";
  const resolved: MetricsReportSchedule = {
    enabled: Boolean(schedule.enabled),
    frequency,
    recipients: Array.isArray(schedule.recipients)
      ? schedule.recipients.map((email) => email.trim()).filter(Boolean)
      : [],
    hour:
      Number.isFinite(schedule.hour) && schedule.hour >= 0 && schedule.hour <= 23
        ? schedule.hour
        : DEFAULT_METRICS_REPORT_SCHEDULE.hour,
    timezone: schedule.timezone?.trim() || DEFAULT_METRICS_REPORT_SCHEDULE.timezone,
    ...(schedule.lastSentAt ? { lastSentAt: schedule.lastSentAt } : {}),
  };

  if (frequency === "weekly") {
    const dayOfWeek =
      Number.isFinite(schedule.dayOfWeek) &&
      schedule.dayOfWeek! >= 1 &&
      schedule.dayOfWeek! <= 7
        ? schedule.dayOfWeek!
        : DEFAULT_METRICS_REPORT_SCHEDULE.dayOfWeek!;
    resolved.dayOfWeek = dayOfWeek;
  }

  return resolved;
}
