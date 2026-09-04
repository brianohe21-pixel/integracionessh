"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  SettingsCard,
  SettingsCardSkeleton,
  SettingsToggleRow,
} from "@/components/settings/SettingsCard";
import {
  useReportSchedule,
  useSaveReportSchedule,
  useSendReportNow,
} from "@/hooks/useReportSchedule";
import {
  formatRecipientsInput,
  getDefaultReportTimezone,
  parseRecipientsInput,
  resolveMetricsReportSchedule,
} from "@/lib/report-schedule";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import type { MetricsReportSchedule, ReportScheduleFrequency } from "@/types";

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function ScheduledReportsCard() {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: settings, isLoading, error: loadError } = useReportSchedule();
  const save = useSaveReportSchedule();
  const sendNow = useSendReportNow();

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<ReportScheduleFrequency>("weekly");
  const [hour, setHour] = useState(8);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timezone, setTimezone] = useState(getDefaultReportTimezone());
  const [recipientsInput, setRecipientsInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!settings) return;
    const resolved = resolveMetricsReportSchedule(settings);
    setEnabled(resolved.enabled);
    setFrequency(resolved.frequency);
    setHour(resolved.hour);
    setDayOfWeek(resolved.dayOfWeek ?? 1);
    setTimezone(resolved.timezone || getDefaultReportTimezone());
    setRecipientsInput(formatRecipientsInput(resolved.recipients));
  }, [settings]);

  function buildPayload(): MetricsReportSchedule {
    const recipients = parseRecipientsInput(recipientsInput);
    return {
      enabled,
      frequency,
      hour: Number(hour),
      dayOfWeek: frequency === "weekly" ? Number(dayOfWeek) : undefined,
      timezone: timezone.trim() || getDefaultReportTimezone(),
      recipients,
      ...(settings?.lastSentAt ? { lastSentAt: settings.lastSentAt } : {}),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload = buildPayload();
    if (payload.enabled && payload.recipients.length === 0) {
      setError(t("settings.scheduledReportsRecipientsRequired"));
      return;
    }

    try {
      await save.mutateAsync(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.scheduledReportsSaveError"));
    }
  }

  async function handleSendNow() {
    setError("");
    const payload = buildPayload();
    if (payload.recipients.length === 0) {
      setError(t("settings.scheduledReportsRecipientsRequired"));
      return;
    }

    try {
      await save.mutateAsync(payload);
      await sendNow.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.scheduledReportsSendError"));
    }
  }

  if (isLoading) {
    return <SettingsCardSkeleton lines={4} />;
  }

  if (loadError) {
    return (
      <SettingsCard
        icon={<FileSpreadsheet className="h-4 w-4" />}
        title={t("settings.scheduledReportsTitle")}
        description={t("settings.scheduledReportsDescription")}
      >
        <p className="text-sm text-red-500">
          {loadError instanceof Error ? loadError.message : t("settings.scheduledReportsSaveError")}
        </p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      icon={<FileSpreadsheet className="h-4 w-4" />}
      title={t("settings.scheduledReportsTitle")}
      description={t("settings.scheduledReportsDescription")}
      badge={
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? t("settings.scheduledReportsEnabled") : t("settings.scheduledReportsDisabled")}
        </Badge>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        <SettingsToggleRow
          label={t("settings.scheduledReportsEnableLabel")}
          checked={enabled}
          onChange={setEnabled}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-secondary">{t("settings.scheduledReportsFrequency")}</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ReportScheduleFrequency)}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
            >
              <option value="daily">{t("settings.scheduledReportsDaily")}</option>
              <option value="weekly">{t("settings.scheduledReportsWeekly")}</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-secondary">{t("settings.scheduledReportsHour")}</span>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
            >
              {Array.from({ length: 24 }, (_, value) => (
                <option key={value} value={value}>
                  {String(value).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>

          {frequency === "weekly" && (
            <label className="block space-y-1">
              <span className="text-sm text-secondary">{t("settings.scheduledReportsDayOfWeek")}</span>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
              >
                {DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {t(`settings.scheduledReportsWeekday${day}`)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-sm text-secondary">{t("settings.scheduledReportsTimezone")}</span>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-secondary">{t("settings.scheduledReportsRecipients")}</span>
          <textarea
            value={recipientsInput}
            onChange={(e) => setRecipientsInput(e.target.value)}
            rows={3}
            placeholder={t("settings.scheduledReportsRecipientsPlaceholder")}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          />
        </label>

        {settings?.lastSentAt && (
          <p className="text-xs text-muted">
            {t("settings.scheduledReportsLastSent", {
              date: formatDate(settings.lastSentAt),
            })}
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("settings.scheduledReportsSaving") : t("settings.scheduledReportsSave")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSendNow}
            disabled={save.isPending || sendNow.isPending}
          >
            {sendNow.isPending ? t("settings.scheduledReportsSending") : t("settings.scheduledReportsSendNow")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
