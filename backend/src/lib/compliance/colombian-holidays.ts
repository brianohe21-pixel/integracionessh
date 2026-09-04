const BOGOTA_TIMEZONE = "America/Bogota";

function getZonedYmd(date: Date, timezone = BOGOTA_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function toFollowingMonday(date: Date): Date {
  const weekday = date.getUTCDay();
  if (weekday === 1) return date;
  const daysUntilMonday = weekday === 0 ? 1 : 8 - weekday;
  return addDays(date, daysUntilMonday);
}

function emiliani(year: number, month: number, day: number): string {
  const observed = toFollowingMonday(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  return getZonedYmd(observed);
}

function fixed(year: number, month: number, day: number): string {
  return getZonedYmd(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

function easterOffset(year: number, days: number): string {
  return getZonedYmd(addDays(getEasterSunday(year), days));
}

export function getColombianHolidayDates(year: number): Set<string> {
  const holidays = new Set<string>();

  holidays.add(fixed(year, 1, 1));
  holidays.add(emiliani(year, 1, 6));
  holidays.add(emiliani(year, 3, 19));
  holidays.add(easterOffset(year, -3));
  holidays.add(easterOffset(year, -2));
  holidays.add(fixed(year, 5, 1));
  holidays.add(easterOffset(year, 43));
  holidays.add(easterOffset(year, 64));
  holidays.add(easterOffset(year, 71));
  holidays.add(emiliani(year, 6, 29));
  holidays.add(fixed(year, 7, 20));
  holidays.add(fixed(year, 8, 7));
  holidays.add(emiliani(year, 8, 15));
  holidays.add(emiliani(year, 10, 12));
  holidays.add(emiliani(year, 11, 1));
  holidays.add(emiliani(year, 11, 11));
  holidays.add(emiliani(year, 12, 8));
  holidays.add(fixed(year, 12, 25));

  return holidays;
}

const holidayCache = new Map<number, Set<string>>();

function getHolidaySetForDate(date: Date): Set<string> {
  const year = Number(getZonedYmd(date).slice(0, 4));
  const years = [year - 1, year, year + 1];
  const combined = new Set<string>();
  for (const y of years) {
    let set = holidayCache.get(y);
    if (!set) {
      set = getColombianHolidayDates(y);
      holidayCache.set(y, set);
    }
    for (const value of set) combined.add(value);
  }
  return combined;
}

export function isColombianHoliday(date: Date = new Date()): boolean {
  const ymd = getZonedYmd(date);
  return getHolidaySetForDate(date).has(ymd);
}
