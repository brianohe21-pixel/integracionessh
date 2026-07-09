"use client";

import type { CalendarConfig } from "@/types";
import { useT } from "@/i18n/context";

interface CalendarSettingsFormProps {
  config: CalendarConfig;
  onChange: (patch: Partial<CalendarConfig>) => void;
}

export function CalendarSettingsForm({ config, onChange }: CalendarSettingsFormProps) {
  const t = useT();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block text-gray-700">{t("calendar.timezone")}</span>
        <input
          type="text"
          value={config.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-700">{t("calendar.slotDuration")}</span>
        <input
          type="number"
          min={5}
          max={480}
          value={config.slotDurationMinutes}
          onChange={(e) => onChange({ slotDurationMinutes: Number(e.target.value) })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-700">{t("calendar.buffer")}</span>
        <input
          type="number"
          min={0}
          max={120}
          value={config.bufferMinutes}
          onChange={(e) => onChange({ bufferMinutes: Number(e.target.value) })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-700">{t("calendar.maxAdvanceDays")}</span>
        <input
          type="number"
          min={1}
          max={90}
          value={config.maxAdvanceDays}
          onChange={(e) => onChange({ maxAdvanceDays: Number(e.target.value) })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-gray-700">{t("calendar.minNoticeHours")}</span>
        <input
          type="number"
          min={0}
          max={168}
          value={config.minNoticeHours}
          onChange={(e) => onChange({ minNoticeHours: Number(e.target.value) })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>
    </div>
  );
}
