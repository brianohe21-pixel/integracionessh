import type { QueueBusinessHours } from "../../types/index.js";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isWithinBusinessHours(
  hours: QueueBusinessHours | undefined,
  now: Date = new Date()
): boolean {
  if (!hours) return true;
  const timezone = hours.timezone?.trim() || "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = (parts.find((part) => part.type === "weekday")?.value ?? "Mon").slice(0, 3);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const key = DAY_KEYS[dayIndex >= 0 ? dayIndex : 1];
  const window = hours.days[key] ?? hours.days[String(dayIndex)] ?? null;
  if (!window) return false;

  const current = hour * 60 + minute;
  const start = parseHm(window.start);
  const end = parseHm(window.end);
  if (start === null || end === null) return true;
  if (end <= start) return current >= start || current < end;
  return current >= start && current < end;
}

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
