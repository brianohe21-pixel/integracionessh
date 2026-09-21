"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { normalizeDateRange } from "@/lib/metrics-date-range";
import {
  ADVISOR_PERIOD_OPTIONS,
  applyAdvisorDatePreset,
  clearAdvisorDateRange,
  hasAdvisorDateRange,
  isAdvisorPresetRange,
  type AdvisorDateField,
  type AdvisorFilterState,
} from "@/lib/advisor-filters";

type Props = {
  filters: AdvisorFilterState;
  onChange: (patch: Partial<AdvisorFilterState>) => void;
};

export function AdvisorDateFilters({ filters, onChange }: Props) {
  const t = useT();

  const inputClass =
    "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="mb-4 rounded-xl border border-default bg-surface-elevated p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("advisors.filterDateField")}
          </label>
          <Select
            value={filters.dateField}
            onChange={(event) => onChange({ dateField: event.target.value as AdvisorDateField })}
            className="w-full"
          >
            <option value="created">{t("advisors.filterDateCreated")}</option>
            <option value="updated">{t("advisors.filterDateUpdated")}</option>
            <option value="lastLogin">{t("advisors.filterDateLastLogin")}</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("metrics.filterDateFrom")}
          </label>
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => {
              const nextFrom = event.target.value;
              if (!nextFrom) {
                onChange({ from: "" });
                return;
              }
              const nextTo = filters.to || nextFrom;
              const range = normalizeDateRange(nextFrom, nextTo);
              onChange({ from: range.from, to: range.to });
            }}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("metrics.filterDateTo")}
          </label>
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => {
              const nextTo = event.target.value;
              if (!nextTo) {
                onChange({ to: "" });
                return;
              }
              const nextFrom = filters.from || nextTo;
              const range = normalizeDateRange(nextFrom, nextTo);
              onChange({ from: range.from, to: range.to });
            }}
            className={inputClass}
          />
        </div>
        {hasAdvisorDateRange(filters) ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => onChange(clearAdvisorDateRange(filters))}
            >
              {t("advisors.clearDateRange")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-secondary">
          {t("metrics.filterPeriod")}
        </p>
        <div className="flex flex-wrap gap-2">
          {ADVISOR_PERIOD_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChange(applyAdvisorDatePreset(filters, days))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                isAdvisorPresetRange(filters, days)
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
