"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import {
  currentMonthRange,
  dateRangeFromDays,
  isCurrentMonthRange,
  isPresetRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";

const PRESET_DAYS = [7, 14, 30] as const;

type UsageDateFiltersProps = {
  range: MetricsDateRange;
  onChange: (range: MetricsDateRange) => void;
};

export function UsageDateFilters({ range, onChange }: UsageDateFiltersProps) {
  const t = useT();

  const inputClass =
    "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  function applyRange(from: string, to: string) {
    onChange(normalizeDateRange(from, to));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("metrics.filterDateFrom")}
          </label>
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => applyRange(e.target.value, range.to)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("metrics.filterDateTo")}
          </label>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => applyRange(range.from, e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {t("metrics.filterPeriod")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(currentMonthRange())}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              isCurrentMonthRange(range)
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800"
            )}
          >
            {t("developer.filterPeriodMonth")}
          </button>
          {PRESET_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChange(dateRangeFromDays(days))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                isPresetRange(range, days)
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800"
              )}
            >
              {t("metrics.filterPeriodDays", { days })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
