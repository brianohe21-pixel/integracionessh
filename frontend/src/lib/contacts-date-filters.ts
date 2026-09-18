import {
  dateRangeFromDays,
  isPresetRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";
import type { ContactDateField } from "@/types";

export const CONTACTS_PERIOD_OPTIONS = [7, 14, 30] as const;

export type ContactsDateFilterState = {
  dateField: ContactDateField;
  from: string;
  to: string;
};

export const EMPTY_CONTACTS_DATE_FILTERS: ContactsDateFilterState = {
  dateField: "lastSeen",
  from: "",
  to: "",
};

export function hasContactsDateRange(filters: ContactsDateFilterState): boolean {
  return Boolean(filters.from && filters.to);
}

export function contactsDateRange(filters: ContactsDateFilterState): MetricsDateRange | null {
  if (!hasContactsDateRange(filters)) return null;
  return normalizeDateRange(filters.from, filters.to);
}

export function isContactsPresetRange(filters: ContactsDateFilterState, days: number): boolean {
  const range = contactsDateRange(filters);
  return range ? isPresetRange(range, days) : false;
}

export function applyContactsDatePreset(
  filters: ContactsDateFilterState,
  days: number
): ContactsDateFilterState {
  const range = dateRangeFromDays(days);
  return { ...filters, from: range.from, to: range.to };
}

export function clearContactsDateRange(filters: ContactsDateFilterState): ContactsDateFilterState {
  return { ...filters, from: "", to: "" };
}
