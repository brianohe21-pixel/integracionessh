import type { Booking, CalendarConfig } from "../../types/index.js";

export interface CalendarProvider {
  createExternalEvent?(booking: Booking, config: CalendarConfig): Promise<string | undefined>;
  cancelExternalEvent?(booking: Booking, config: CalendarConfig): Promise<void>;
}

export class NativeCalendarProvider implements CalendarProvider {}

export function getCalendarProvider(provider: CalendarConfig["provider"]): CalendarProvider {
  if (provider === "native") return new NativeCalendarProvider();
  return new NativeCalendarProvider();
}
