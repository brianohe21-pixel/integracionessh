"use client";

import type { CalendarConfig } from "@/types";
import { useLocale, useT } from "@/i18n/context";
import { getCalendarTimezoneOptions } from "@/lib/timezones";
import { FieldLabel } from "@/components/ui/FieldLabel";

interface CalendarSettingsFormProps {
  config: CalendarConfig;
  onChange: (patch: Partial<CalendarConfig>) => void;
}

export function CalendarSettingsForm({ config, onChange }: CalendarSettingsFormProps) {
  const t = useT();
  const locale = useLocale();
  const timezoneOptions = getCalendarTimezoneOptions(locale, config.timezone);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        <FieldLabel label={t("calendar.timezone")} tooltip={t("calendar.fieldHints.timezone")} />
        <select
          value={config.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className="w-full rounded-lg border border-default bg-surface-elevated px-3 py-2"
        >
          {timezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <FieldLabel
          label={t("calendar.slotDuration")}
          tooltip={t("calendar.fieldHints.slotDuration")}
        />
        <input
          type="number"
          min={5}
          max={480}
          value={config.slotDurationMinutes}
          onChange={(e) => onChange({ slotDurationMinutes: Number(e.target.value) })}
          className="w-full rounded-lg border border-default px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <FieldLabel label={t("calendar.buffer")} tooltip={t("calendar.fieldHints.buffer")} />
        <input
          type="number"
          min={0}
          max={120}
          value={config.bufferMinutes}
          onChange={(e) => onChange({ bufferMinutes: Number(e.target.value) })}
          className="w-full rounded-lg border border-default px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <FieldLabel
          label={t("calendar.maxAdvanceDays")}
          tooltip={t("calendar.fieldHints.maxAdvanceDays")}
        />
        <input
          type="number"
          min={1}
          max={90}
          value={config.maxAdvanceDays}
          onChange={(e) => onChange({ maxAdvanceDays: Number(e.target.value) })}
          className="w-full rounded-lg border border-default px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <FieldLabel
          label={t("calendar.minNoticeHours")}
          tooltip={t("calendar.fieldHints.minNoticeHours")}
        />
        <input
          type="number"
          min={0}
          max={168}
          value={config.minNoticeHours}
          onChange={(e) => onChange({ minNoticeHours: Number(e.target.value) })}
          className="w-full rounded-lg border border-default px-3 py-2"
        />
      </label>
    </div>
  );
}
