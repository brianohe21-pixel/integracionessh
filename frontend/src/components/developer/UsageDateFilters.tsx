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
    "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent";

  function applyRange(from: string, to: string) {
    onChange(normalizeDateRange(from, to));
  }

  return (
    <div className="rounded-xl border border-default bg-surface-elevated p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-secondary">
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
          <label className="text-xs font-medium uppercase tracking-wide text-secondary">
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
        <p className="text-xs font-medium uppercase tracking-wide text-secondary">
          {t("metrics.filterPeriod")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(currentMonthRange())}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              isCurrentMonthRange(range)
                ? "border-accent bg-accent-muted text-accent"
                : "border-default text-secondary hover:border-default hover:text-primary"
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
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-default text-secondary hover:border-default hover:text-primary"
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
