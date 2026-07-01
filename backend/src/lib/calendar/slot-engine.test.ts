import { describe, expect, it } from "@jest/globals";
import type { Booking, CalendarConfig } from "../../types/index.js";
import { DEFAULT_WEEKLY_SCHEDULE } from "../../types/index.js";
import {
  generateAvailableSlots,
  getAvailableDates,
  getSlotsForDate,
  hasBookingOverlap,
  localDateTimeToUtc,
} from "./slot-engine.js";

const baseConfig: CalendarConfig = {
  tenantId: "t1",
  botId: "b1",
  enabled: true,
  timezone: "America/Bogota",
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  maxAdvanceDays: 14,
  minNoticeHours: 2,
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
  provider: "native",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("localDateTimeToUtc", () => {
  it("converts local time in timezone to UTC", () => {
    const utc = localDateTimeToUtc("2026-07-01", "09:00", "America/Bogota");
    const hour = utc.getUTCHours();
    expect([13, 14]).toContain(hour);
  });
});

describe("generateAvailableSlots", () => {
  it("returns slots within weekly schedule", () => {
    const now = localDateTimeToUtc("2026-07-01", "08:00", "America/Bogota");
    const to = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const slots = generateAvailableSlots({
      config: baseConfig,
      bookings: [],
      from: now,
      to,
      now,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.startAt).toBeTruthy();
  });

  it("excludes slots blocked by existing bookings", () => {
    const now = localDateTimeToUtc("2026-07-01", "08:00", "America/Bogota");
    const slotStart = localDateTimeToUtc("2026-07-01", "10:00", "America/Bogota");
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    const booking: Booking = {
      bookingId: "bk1",
      tenantId: "t1",
      botId: "b1",
      contactPhone: "573001234567",
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
      status: "confirmed",
      source: "manual",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const slots = getSlotsForDate({
      config: baseConfig,
      bookings: [booking],
      isoDate: "2026-07-01",
      now,
    });
    expect(slots.some((s) => s.startAt === slotStart.toISOString())).toBe(false);
  });

  it("respects minNoticeHours", () => {
    const now = localDateTimeToUtc("2026-07-01", "09:30", "America/Bogota");
    const slots = getSlotsForDate({
      config: { ...baseConfig, minNoticeHours: 4 },
      bookings: [],
      isoDate: "2026-07-01",
      now,
    });
    for (const slot of slots) {
      expect(new Date(slot.startAt).getTime()).toBeGreaterThanOrEqual(
        now.getTime() + 4 * 60 * 60 * 1000 - 1000
      );
    }
  });
});

describe("getAvailableDates", () => {
  it("returns up to maxDays dates with availability", () => {
    const now = localDateTimeToUtc("2026-07-01", "08:00", "America/Bogota");
    const dates = getAvailableDates({
      config: baseConfig,
      bookings: [],
      maxDays: 3,
      now,
    });
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.length).toBeLessThanOrEqual(3);
  });
});

describe("hasBookingOverlap", () => {
  it("detects overlapping confirmed bookings with buffer", () => {
    const start = new Date("2026-07-01T15:00:00.000Z");
    const end = new Date("2026-07-01T15:30:00.000Z");
    const bookings: Booking[] = [
      {
        bookingId: "bk1",
        tenantId: "t1",
        botId: "b1",
        contactPhone: "573001234567",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        status: "confirmed",
        source: "manual",
        createdAt: start.toISOString(),
        updatedAt: start.toISOString(),
      },
    ];
    const probeStart = new Date("2026-07-01T15:15:00.000Z");
    const probeEnd = new Date("2026-07-01T15:45:00.000Z");
    expect(hasBookingOverlap(bookings, probeStart, probeEnd, 15)).toBe(true);
    expect(hasBookingOverlap(bookings, probeStart, probeEnd, 0)).toBe(true);
  });
});
