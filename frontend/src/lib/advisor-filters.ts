import {
  dateRangeFromDays,
  isPresetRange,
  isWithinDateRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";
import type { Advisor } from "@/types";

export type AdvisorStatusFilter = "" | "active" | "inactive";
export type AdvisorAccessFilter = "" | "panel" | "none";
export type AdvisorDateField = "created" | "updated" | "lastLogin";

export const ADVISOR_PERIOD_OPTIONS = [7, 14, 30] as const;

export type AdvisorFilterState = {
  search: string;
  status: AdvisorStatusFilter;
  botId: string;
  access: AdvisorAccessFilter;
  dateField: AdvisorDateField;
  from: string;
  to: string;
};

export const EMPTY_ADVISOR_FILTERS: AdvisorFilterState = {
  search: "",
  status: "",
  botId: "",
  access: "",
  dateField: "created",
  from: "",
  to: "",
};

export function hasAdvisorDateRange(filters: AdvisorFilterState): boolean {
  return Boolean(filters.from && filters.to);
}

export function advisorDateRange(filters: AdvisorFilterState): MetricsDateRange | null {
  if (!hasAdvisorDateRange(filters)) return null;
  return normalizeDateRange(filters.from, filters.to);
}

export function isAdvisorPresetRange(filters: AdvisorFilterState, days: number): boolean {
  const range = advisorDateRange(filters);
  return range ? isPresetRange(range, days) : false;
}

export function applyAdvisorDatePreset(filters: AdvisorFilterState, days: number): AdvisorFilterState {
  const range = dateRangeFromDays(days);
  return { ...filters, from: range.from, to: range.to };
}

export function clearAdvisorDateRange(filters: AdvisorFilterState): AdvisorFilterState {
  return { ...filters, from: "", to: "" };
}

function advisorDateValue(advisor: Advisor, field: AdvisorDateField): string | undefined {
  if (field === "created") return advisor.createdAt;
  if (field === "updated") return advisor.updatedAt;
  return advisor.lastLoginAt;
}

export function advisorMatchesDateRange(advisor: Advisor, filters: AdvisorFilterState): boolean {
  const range = advisorDateRange(filters);
  if (!range) return true;

  const value = advisorDateValue(advisor, filters.dateField);
  if (!value) return false;

  return isWithinDateRange(value, range);
}

export function advisorMatchesBotFilter(advisor: Advisor, botId: string): boolean {
  if (!botId) return true;
  if (!advisor.botIds?.length) return true;
  return advisor.botIds.includes(botId);
}

export function advisorMatchesAccessFilter(advisor: Advisor, access: AdvisorAccessFilter): boolean {
  if (!access) return true;
  if (access === "panel") return Boolean(advisor.cognitoUserId);
  return !advisor.cognitoUserId;
}

export function filterAdvisors(advisors: Advisor[], filters: AdvisorFilterState): Advisor[] {
  const search = filters.search.trim().toLowerCase();

  return advisors
    .filter((advisor) => {
      if (filters.status && advisor.status !== filters.status) return false;
      if (!advisorMatchesBotFilter(advisor, filters.botId)) return false;
      if (!advisorMatchesAccessFilter(advisor, filters.access)) return false;
      if (!advisorMatchesDateRange(advisor, filters)) return false;
      if (!search) return true;

      const phone = advisor.phoneNumber.replace(/\D/g, "");
      const queryDigits = search.replace(/\D/g, "");

      return (
        advisor.name.toLowerCase().includes(search) ||
        advisor.phoneNumber.toLowerCase().includes(search) ||
        (queryDigits.length > 0 && phone.includes(queryDigits))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function hasAdvisorFilters(filters: AdvisorFilterState): boolean {
  return Boolean(
    filters.search || filters.status || filters.botId || filters.access || hasAdvisorDateRange(filters)
  );
}
