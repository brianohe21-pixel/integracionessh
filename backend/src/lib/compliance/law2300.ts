import { isWithinBusinessHours } from "../contact-center/hours.js";
import { isColombianHoliday } from "./colombian-holidays.js";
import type { QueueBusinessHours, Tenant } from "../../types/index.js";

export const LAW_2300_TIMEZONE = "America/Bogota";

export const LAW_2300_WINDOWS: QueueBusinessHours = {
  timezone: LAW_2300_TIMEZONE,
  days: {
    sun: null,
    mon: { start: "07:00", end: "19:00" },
    tue: { start: "07:00", end: "19:00" },
    wed: { start: "07:00", end: "19:00" },
    thu: { start: "07:00", end: "19:00" },
    fri: { start: "07:00", end: "19:00" },
    sat: { start: "08:00", end: "15:00" },
  },
};

export type Law2300BlockReason = "holiday" | "outside_window" | "sunday";

export interface Law2300Evaluation {
  enforced: boolean;
  allowed: boolean;
  reason?: Law2300BlockReason;
  nextWindowAt?: Date;
}

export function isLaw2300EnforcedForTenant(
  tenant?: Pick<Tenant, "law2300Exempt"> | null
): boolean {
  return !tenant?.law2300Exempt;
}

export function evaluateLaw2300At(
  now: Date,
  tenant?: Pick<Tenant, "law2300Exempt"> | null
): Law2300Evaluation {
  if (!isLaw2300EnforcedForTenant(tenant)) {
    return { enforced: false, allowed: true };
  }

  if (isColombianHoliday(now)) {
    return {
      enforced: true,
      allowed: false,
      reason: "holiday",
      nextWindowAt: getNextLaw2300WindowStart(now),
    };
  }

  const weekday = getWeekdayShort(now);
  if (weekday === "Sun") {
    return {
      enforced: true,
      allowed: false,
      reason: "sunday",
      nextWindowAt: getNextLaw2300WindowStart(now),
    };
  }

  if (!isWithinBusinessHours(LAW_2300_WINDOWS, now)) {
    return {
      enforced: true,
      allowed: false,
      reason: "outside_window",
      nextWindowAt: getNextLaw2300WindowStart(now),
    };
  }

  return { enforced: true, allowed: true };
}

export function getNextLaw2300WindowStart(from: Date = new Date()): Date {
  let candidate = new Date(from.getTime() + 60_000);
  candidate.setSeconds(0, 0);

  for (let i = 0; i < 366 * 24 * 60; i++) {
    const evaluation = evaluateLaw2300At(candidate);
    if (evaluation.allowed) return candidate;
    if (evaluation.nextWindowAt && evaluation.nextWindowAt > candidate) {
      candidate = new Date(evaluation.nextWindowAt);
      continue;
    }
    candidate = new Date(candidate.getTime() + 60_000);
  }

  return candidate;
}

function getWeekdayShort(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LAW_2300_TIMEZONE,
    weekday: "short",
  }).formatToParts(date);
  return parts.find((part) => part.type === "weekday")?.value ?? "Mon";
}
