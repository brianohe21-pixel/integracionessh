export interface MetricsDateRange {
  from: string;
  to: string;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateRangeFromDays(days: number, now = new Date()): MetricsDateRange {
  const clampedDays = Math.min(Math.max(days, 1), 90);
  const to = formatDateUtc(now);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (clampedDays - 1));
  return { from: formatDateUtc(start), to };
}

export function normalizeDateRange(from: string, to: string): MetricsDateRange {
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
    return dateRangeFromDays(7);
  }
  let nextFrom = from;
  let nextTo = to;
  if (nextFrom > nextTo) {
    [nextFrom, nextTo] = [nextTo, nextFrom];
  }
  const maxFrom = shiftDateUtc(nextTo, -89);
  if (nextFrom < maxFrom) nextFrom = maxFrom;
  return { from: nextFrom, to: nextTo };
}

function shiftDateUtc(dateStr: string, dayDelta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return formatDateUtc(date);
}

export function isWithinDateRange(iso: string, range: MetricsDateRange): boolean {
  const ts = new Date(iso).getTime();
  const fromTs = Date.parse(`${range.from}T00:00:00.000Z`);
  const toTs = Date.parse(`${range.to}T23:59:59.999Z`);
  return ts >= fromTs && ts <= toTs;
}

export function isPresetRange(range: MetricsDateRange, days: number): boolean {
  const preset = dateRangeFromDays(days);
  return range.from === preset.from && range.to === preset.to;
}
