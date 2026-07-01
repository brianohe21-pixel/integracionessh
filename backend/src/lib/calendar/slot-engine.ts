import type {
  AvailableSlot,
  Booking,
  CalendarConfig,
  TimeRange,
  Weekday,
} from "../../types/index.js";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const weekdayShort = map.weekday?.toLowerCase().slice(0, 3) ?? "";
  const weekday = (
    {
      sun: "sunday",
      mon: "monday",
      tue: "tuesday",
      wed: "wednesday",
      thu: "thursday",
      fri: "friday",
      sat: "saturday",
    } as Record<string, Weekday>
  )[weekdayShort];
  return {
    year: map.year ?? "1970",
    month: map.month ?? "01",
    day: map.day ?? "01",
    hour: Number(map.hour ?? 0),
    minute: Number(map.minute ?? 0),
    weekday: weekday ?? "monday",
    isoDate: `${map.year}-${map.month}-${map.day}`,
  };
}

export function localDateTimeToUtc(
  isoDate: string,
  hhmm: string,
  timezone: string
): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 4; i++) {
    const local = getZonedParts(new Date(utcMs), timezone);
    const localMinutes = local.hour * 60 + local.minute;
    const targetMinutes = hour * 60 + minute;
    const dayDiff =
      Number(local.year) * 10000 +
      Number(local.month) * 100 +
      Number(local.day) -
      (year * 10000 + month * 100 + day);
    const deltaMinutes = dayDiff * 24 * 60 + (targetMinutes - localMinutes);
    if (deltaMinutes === 0) break;
    utcMs += deltaMinutes * 60 * 1000;
  }

  return new Date(utcMs);
}

export function formatSlotLabel(startAt: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startAt);
}

export function formatDateLabel(isoDate: string, timezone: string): string {
  const utc = localDateTimeToUtc(isoDate, "12:00", timezone);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(utc);
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
  bufferMinutes: number
): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  return aStart < new Date(bEnd.getTime() + bufferMs) && bStart < new Date(aEnd.getTime() + bufferMs);
}

function isSlotBlocked(
  slotStart: Date,
  slotEnd: Date,
  bookings: Booking[],
  bufferMinutes: number
): boolean {
  return bookings.some(
    (b) =>
      b.status === "confirmed" &&
      rangesOverlap(slotStart, slotEnd, new Date(b.startAt), new Date(b.endAt), bufferMinutes)
  );
}

function generateSlotsForDay(
  isoDate: string,
  ranges: TimeRange[],
  config: CalendarConfig,
  bookings: Booking[],
  now: Date
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const minStart = new Date(now.getTime() + config.minNoticeHours * 60 * 60 * 1000);

  for (const range of ranges) {
    const rangeStart = parseTimeToMinutes(range.start);
    const rangeEnd = parseTimeToMinutes(range.end);
    for (
      let cursor = rangeStart;
      cursor + config.slotDurationMinutes <= rangeEnd;
      cursor += config.slotDurationMinutes + config.bufferMinutes
    ) {
      const startHhmm = formatMinutesAsTime(cursor);
      const endHhmm = formatMinutesAsTime(cursor + config.slotDurationMinutes);
      const slotStart = localDateTimeToUtc(isoDate, startHhmm, config.timezone);
      const slotEnd = localDateTimeToUtc(isoDate, endHhmm, config.timezone);
      if (slotStart < minStart) continue;
      if (isSlotBlocked(slotStart, slotEnd, bookings, config.bufferMinutes)) continue;
      slots.push({
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        label: formatSlotLabel(slotStart, config.timezone),
      });
    }
  }

  return slots;
}

export function generateAvailableSlots(params: {
  config: CalendarConfig;
  bookings: Booking[];
  from: Date;
  to: Date;
  now?: Date;
}): AvailableSlot[] {
  const now = params.now ?? new Date();
  const allSlots: AvailableSlot[] = [];
  const cursor = new Date(params.from);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= params.to) {
    const parts = getZonedParts(cursor, params.config.timezone);
    const weekday = parts.weekday;
    const ranges = params.config.weeklySchedule[weekday] ?? [];
    if (ranges.length > 0) {
      allSlots.push(
        ...generateSlotsForDay(parts.isoDate, ranges, params.config, params.bookings, now)
      );
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return allSlots.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function getAvailableDates(params: {
  config: CalendarConfig;
  bookings: Booking[];
  maxDays: number;
  now?: Date;
}): Array<{ isoDate: string; label: string }> {
  const now = params.now ?? new Date();
  const to = new Date(now.getTime() + params.config.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const limit = Math.min(params.maxDays, params.config.maxAdvanceDays);
  const slots = generateAvailableSlots({
    config: params.config,
    bookings: params.bookings,
    from: now,
    to,
    now,
  });
  const dates = new Map<string, string>();
  for (const slot of slots) {
    const parts = getZonedParts(new Date(slot.startAt), params.config.timezone);
    if (!dates.has(parts.isoDate)) {
      dates.set(parts.isoDate, formatDateLabel(parts.isoDate, params.config.timezone));
    }
    if (dates.size >= limit) break;
  }
  return Array.from(dates.entries()).map(([isoDate, label]) => ({ isoDate, label }));
}

export function getSlotsForDate(params: {
  config: CalendarConfig;
  bookings: Booking[];
  isoDate: string;
  now?: Date;
}): AvailableSlot[] {
  const now = params.now ?? new Date();
  const dayStart = localDateTimeToUtc(params.isoDate, "00:00", params.config.timezone);
  const dayEnd = localDateTimeToUtc(params.isoDate, "23:59", params.config.timezone);
  return generateAvailableSlots({
    config: params.config,
    bookings: params.bookings,
    from: dayStart,
    to: dayEnd,
    now,
  });
}

export function hasBookingOverlap(
  bookings: Booking[],
  startAt: Date,
  endAt: Date,
  bufferMinutes: number,
  excludeBookingId?: string
): boolean {
  return bookings.some(
    (b) =>
      b.status === "confirmed" &&
      b.bookingId !== excludeBookingId &&
      rangesOverlap(startAt, endAt, new Date(b.startAt), new Date(b.endAt), bufferMinutes)
  );
}
