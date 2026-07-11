import { resolveBookingAmountInCents } from "./payment.js";
import type { CalendarConfig, PaymentsConfig } from "../../types/index.js";

const baseCalendar: CalendarConfig = {
  tenantId: "t1",
  botId: "b1",
  enabled: true,
  timezone: "America/Bogota",
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  maxAdvanceDays: 30,
  minNoticeHours: 0,
  weeklySchedule: {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  },
  provider: "native",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const basePayments: PaymentsConfig = {
  tenantId: "t1",
  botId: "b1",
  enabled: true,
  currency: "COP",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("resolveBookingAmountInCents", () => {
  it("returns null when auto collect is disabled", () => {
    expect(
      resolveBookingAmountInCents(
        { ...baseCalendar, autoCollectPayment: false, bookingPriceInCents: 50000 },
        basePayments
      )
    ).toBeNull();
  });

  it("uses calendar booking price when configured", () => {
    expect(
      resolveBookingAmountInCents(
        { ...baseCalendar, autoCollectPayment: true, bookingPriceInCents: 75000 },
        basePayments
      )
    ).toBe(75000);
  });

  it("falls back to payments default amount", () => {
    expect(
      resolveBookingAmountInCents(
        { ...baseCalendar, autoCollectPayment: true },
        { ...basePayments, defaultAmountInCents: 50000 }
      )
    ).toBe(50000);
  });

  it("prefers calendar price over payments default", () => {
    expect(
      resolveBookingAmountInCents(
        { ...baseCalendar, autoCollectPayment: true, bookingPriceInCents: 80000 },
        { ...basePayments, defaultAmountInCents: 50000 }
      )
    ).toBe(80000);
  });
});
