import type { AdvisorWorkloadMetric, AdvisorWorkloadUnassigned } from "@/types";
import {
  dateRangeFromDays,
  isPresetRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";

export type SupervisorSlaFilter = "" | "breached" | "at_risk" | "ok";
export type SupervisorWorkloadFilter = "" | "active" | "idle";

export type SupervisorFilterState = {
  search: string;
  botId: string;
  from: string;
  to: string;
  sla: SupervisorSlaFilter;
  workload: SupervisorWorkloadFilter;
};

export const SUPERVISOR_PERIOD_OPTIONS = [7, 14, 30] as const;

export function hasSupervisorDateRange(filters: SupervisorFilterState): boolean {
  return Boolean(filters.from && filters.to);
}

export function supervisorDateRange(filters: SupervisorFilterState): MetricsDateRange | null {
  if (!hasSupervisorDateRange(filters)) return null;
  return normalizeDateRange(filters.from, filters.to);
}

export function matchesSlaFilter(
  slaBreached: number,
  slaAtRisk: number,
  filter: SupervisorSlaFilter
): boolean {
  if (!filter) return true;
  if (filter === "breached") return slaBreached > 0;
  if (filter === "at_risk") return slaAtRisk > 0 && slaBreached === 0;
  return slaBreached === 0 && slaAtRisk === 0;
}

export function matchesWorkloadFilter(
  totalActive: number,
  filter: SupervisorWorkloadFilter
): boolean {
  if (!filter) return true;
  if (filter === "active") return totalActive > 0;
  return totalActive === 0;
}

export function filterAdvisorWorkload(
  advisors: AdvisorWorkloadMetric[],
  unassigned: AdvisorWorkloadUnassigned,
  filters: SupervisorFilterState,
  unassignedLabel: string
): { advisors: AdvisorWorkloadMetric[]; showUnassigned: boolean } {
  const search = filters.search.trim().toLowerCase();

  const filteredAdvisors = advisors.filter((advisor) => {
    if (search && !advisor.name.toLowerCase().includes(search)) return false;
    if (!matchesSlaFilter(advisor.slaBreached, advisor.slaAtRisk, filters.sla)) return false;
    if (!matchesWorkloadFilter(advisor.totalActive, filters.workload)) return false;
    return true;
  });

  const showUnassigned =
    (!search || unassignedLabel.toLowerCase().includes(search)) &&
    matchesSlaFilter(unassigned.slaBreached, unassigned.slaAtRisk, filters.sla) &&
    matchesWorkloadFilter(unassigned.totalActive, filters.workload);

  return { advisors: filteredAdvisors, showUnassigned };
}

export function hasSupervisorFilters(filters: SupervisorFilterState): boolean {
  return Boolean(
    filters.search || filters.botId || filters.sla || filters.workload || hasSupervisorDateRange(filters)
  );
}

export function isSupervisorPresetRange(filters: SupervisorFilterState, days: number): boolean {
  const range = supervisorDateRange(filters);
  return range ? isPresetRange(range, days) : false;
}

export function applySupervisorDatePreset(
  filters: SupervisorFilterState,
  days: number
): SupervisorFilterState {
  const range = dateRangeFromDays(days);
  return { ...filters, from: range.from, to: range.to };
}

export function clearSupervisorDateRange(filters: SupervisorFilterState): SupervisorFilterState {
  return { ...filters, from: "", to: "" };
}
