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

export function currentMonthRange(now = new Date()): MetricsDateRange {
  const from = formatDateUtc(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const to = formatDateUtc(now);
  return { from, to };
}

export function isCurrentMonthRange(range: MetricsDateRange, now = new Date()): boolean {
  const preset = currentMonthRange(now);
  return range.from === preset.from && range.to === preset.to;
}

function previousMonthRange(now = new Date()): MetricsDateRange {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: formatDateUtc(from), to: formatDateUtc(to) };
}

function isPreviousMonthRange(range: MetricsDateRange, now = new Date()): boolean {
  const preset = previousMonthRange(now);
  return range.from === preset.from && range.to === preset.to;
}

export function getDashboardRangeLabel(
  range: MetricsDateRange,
  labels: {
    last7: string;
    last14: string;
    last30: string;
    thisMonth: string;
    lastMonth: string;
    custom: (from: string, to: string) => string;
  },
  locale = "es"
): string {
  if (isPresetRange(range, 7)) return labels.last7;
  if (isPresetRange(range, 14)) return labels.last14;
  if (isPresetRange(range, 30)) return labels.last30;
  if (isCurrentMonthRange(range)) return labels.thisMonth;
  if (isPreviousMonthRange(range)) return labels.lastMonth;

  const intlLocale = locale === "en" ? "en-US" : "es-ES";
  const formatShort = (dateStr: string) =>
    new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "short" }).format(
      new Date(`${dateStr}T12:00:00.000Z`)
    );
  return labels.custom(formatShort(range.from), formatShort(range.to));
}

export function dateRangeToIso(range: MetricsDateRange): { from: string; to: string } {
  const normalized = normalizeDateRange(range.from, range.to);
  return {
    from: `${normalized.from}T00:00:00.000Z`,
    to: `${normalized.to}T23:59:59.999Z`,
  };
}
