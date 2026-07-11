"use client";

import type { CalendarConfig } from "@/types";
import { useT } from "@/i18n/context";

interface CalendarWaitlistSettingsProps {
  config: CalendarConfig;
  onChange: (patch: Partial<CalendarConfig>) => void;
}

export function CalendarWaitlistSettings({ config, onChange }: CalendarWaitlistSettingsProps) {
  const t = useT();

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{t("calendar.waitlist.title")}</h3>
          <p className="mt-1 text-sm text-gray-500">{t("calendar.waitlist.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ waitlistEnabled: !config.waitlistEnabled })}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            config.waitlistEnabled
              ? "bg-gray-600 hover:bg-gray-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {config.waitlistEnabled ? t("calendar.waitlist.disable") : t("calendar.waitlist.enable")}
        </button>
      </div>
    </section>
  );
}
