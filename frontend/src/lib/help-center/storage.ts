import type { TourId } from "./tours";

const TOURS_KEY = "help-center-tours-completed";
const HINTS_KEY = "help-center-hints-dismissed";

function readJsonArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(values));
}

export function getCompletedTours(): TourId[] {
  return readJsonArray(TOURS_KEY) as TourId[];
}

export function markTourCompleted(tourId: TourId) {
  const current = getCompletedTours();
  if (current.includes(tourId)) return;
  writeJsonArray(TOURS_KEY, [...current, tourId]);
}

export function getDismissedHints(): string[] {
  return readJsonArray(HINTS_KEY);
}

export function dismissHint(hintId: string) {
  const current = getDismissedHints();
  if (current.includes(hintId)) return;
  writeJsonArray(HINTS_KEY, [...current, hintId]);
}
