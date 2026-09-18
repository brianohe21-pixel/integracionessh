"use client";

import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { normalizeDateRange } from "@/lib/metrics-date-range";
import type {
  SupervisorFilterState,
  SupervisorSlaFilter,
  SupervisorWorkloadFilter,
} from "@/lib/supervisor-filters";
import {
  applySupervisorDatePreset,
  clearSupervisorDateRange,
  hasSupervisorDateRange,
  hasSupervisorFilters,
  isSupervisorPresetRange,
  SUPERVISOR_PERIOD_OPTIONS,
} from "@/lib/supervisor-filters";

type Props = {
  filters: SupervisorFilterState;
  bots: Array<{ botId: string; name: string }>;
  onChange: (patch: Partial<SupervisorFilterState>) => void;
  onClear: () => void;
};

export function SupervisorFilters({ filters, bots, onChange, onClear }: Props) {
  const t = useT();

  const inputClass =
    "w-full px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="mb-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder={t("supervisor.searchPlaceholder")}
          onClear={() => onChange({ search: "" })}
          className="sm:min-w-[240px] sm:flex-1"
        />
        <Select
          value={filters.botId}
          onChange={(event) => onChange({ botId: event.target.value })}
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("automations.allBots")}</option>
          {bots.map((bot) => (
            <option key={bot.botId} value={bot.botId}>
              {bot.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.sla}
          onChange={(event) => onChange({ sla: event.target.value as SupervisorSlaFilter })}
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("supervisor.filterAllSla")}</option>
          <option value="breached">{t("conversations.slaBreached")}</option>
          <option value="at_risk">{t("conversations.slaAtRisk")}</option>
          <option value="ok">{t("supervisor.filterSlaOk")}</option>
        </Select>
        <Select
          value={filters.workload}
          onChange={(event) =>
            onChange({ workload: event.target.value as SupervisorWorkloadFilter })
          }
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("supervisor.filterAllWorkload")}</option>
          <option value="active">{t("supervisor.filterWorkloadActive")}</option>
          <option value="idle">{t("supervisor.filterWorkloadIdle")}</option>
        </Select>
        {hasSupervisorFilters(filters) && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <FilterX className="h-4 w-4" />
            {t("conversations.clearFilters")}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-default bg-surface-elevated p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
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
          {hasSupervisorDateRange(filters) ? (
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => onChange(clearSupervisorDateRange(filters))}
              >
                {t("supervisor.filterLive")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            {t("metrics.filterPeriod")}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUPERVISOR_PERIOD_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChange(applySupervisorDatePreset(filters, days))}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                  isSupervisorPresetRange(filters, days)
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
    </div>
  );
}
