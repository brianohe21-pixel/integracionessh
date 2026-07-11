import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildIntegrationPayload } from "../integrations/payloads.js";
import {
  countEnabledCalendars,
  getCalendarConfig,
  listEnabledCalendarConfigs,
  upsertCalendarConfig,
} from "../dynamodb/calendar-config.repository.js";
import {
  createBooking,
  getBooking,
  listBookingsForBot,
  makeBookingId,
  updateBooking,
} from "../dynamodb/booking.repository.js";
import type {
  AvailableSlot,
  Booking,
  BookingSource,
  BookingStatus,
  CalendarConfig,
  WeeklySchedule,
} from "../../types/index.js";
import { DEFAULT_WEEKLY_SCHEDULE } from "../../types/index.js";
import { getCalendarProvider } from "./provider.js";
import {
  formatDateLabel,
  formatSlotLabel,
  generateAvailableSlots,
  getAvailableDates,
  getSlotsForDate,
  hasBookingOverlap,
} from "./slot-engine.js";
import { cancelBookingReminder,
  scheduleBookingReminder,
} from "./reminder-schedule.js";

export function defaultCalendarConfig(tenantId: string, botId: string): CalendarConfig {
  const now = new Date().toISOString();
  return {
    tenantId,
    botId,
    enabled: false,
    timezone: "America/Bogota",
    slotDurationMinutes: 30,
    bufferMinutes: 15,
    maxAdvanceDays: 30,
    minNoticeHours: 2,
    weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
    provider: "native",
    reminderEnabled: false,
    reminderMinutesBefore: 60,
    reminderChannel: "whatsapp_text",
    reminderMessage:
      "Hola {{name}}, te recordamos tu cita el {{date}} a las {{time}}.",
    reminderTemplateLanguage: "es",
    createdAt: now,
    updatedAt: now,
  };
}

export async function getConfigOrDefault(
  tenantId: string,
  botId: string
): Promise<CalendarConfig> {
  const existing = await getCalendarConfig(tenantId, botId);
  return existing ?? defaultCalendarConfig(tenantId, botId);
}

export async function enableCalendar(tenantId: string, botId: string): Promise<CalendarConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCalendarConfig({ ...existing, enabled: true });
}

export async function disableCalendar(tenantId: string, botId: string): Promise<CalendarConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCalendarConfig({ ...existing, enabled: false });
}

export async function saveCalendarConfig(
  tenantId: string,
  botId: string,
  patch: Partial<
    Pick<
      CalendarConfig,
      | "timezone"
      | "slotDurationMinutes"
      | "bufferMinutes"
      | "maxAdvanceDays"
      | "minNoticeHours"
      | "weeklySchedule"
      | "reminderEnabled"
      | "reminderMinutesBefore"
      | "reminderChannel"
      | "reminderMessage"
      | "reminderTemplateName"
      | "reminderTemplateLanguage"
    >
  >
): Promise<CalendarConfig> {
  const existing = await getConfigOrDefault(tenantId, botId);
  return upsertCalendarConfig({
    ...existing,
    ...patch,
    weeklySchedule: patch.weeklySchedule ?? existing.weeklySchedule,
  });
}

export async function requireEnabledCalendar(
  tenantId: string,
  botId: string
): Promise<CalendarConfig> {
  const config = await getCalendarConfig(tenantId, botId);
  if (!config?.enabled) {
    throw new Error("Calendar app is not enabled for this bot");
  }
  return config;
}

async function loadConfirmedBookings(
  tenantId: string,
  botId: string,
  from?: string,
  to?: string
): Promise<Booking[]> {
  const params: {
    tenantId: string;
    botId: string;
    status: "confirmed";
    from?: string;
    to?: string;
  } = { tenantId, botId, status: "confirmed" };
  if (from) params.from = from;
  if (to) params.to = to;
  return listBookingsForBot(params);
}

export async function getAvailableSlots(params: {
  tenantId: string;
  botId: string;
  from?: string;
  to?: string;
}): Promise<AvailableSlot[]> {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  const now = new Date();
  const from = params.from ? new Date(params.from) : now;
  const to = params.to
    ? new Date(params.to)
    : new Date(now.getTime() + config.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const bookings = await loadConfirmedBookings(
    params.tenantId,
    params.botId,
    from.toISOString(),
    to.toISOString()
  );
  return generateAvailableSlots({ config, bookings, from, to, now });
}

export async function getBookingDates(params: {
  tenantId: string;
  botId: string;
  maxDays: number;
}) {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  const now = new Date();
  const to = new Date(now.getTime() + config.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const bookings = await loadConfirmedBookings(
    params.tenantId,
    params.botId,
    now.toISOString(),
    to.toISOString()
  );
  return getAvailableDates({
    config,
    bookings,
    maxDays: params.maxDays,
    now,
  });
}

export async function getBookingSlotsForDate(params: {
  tenantId: string;
  botId: string;
  isoDate: string;
}) {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  const now = new Date();
  const dayStart = new Date(`${params.isoDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${params.isoDate}T23:59:59.999Z`);
  const bookings = await loadConfirmedBookings(
    params.tenantId,
    params.botId,
    dayStart.toISOString(),
    dayEnd.toISOString()
  );
  return getSlotsForDate({
    config,
    bookings,
    isoDate: params.isoDate,
    now,
  });
}

export async function listBookings(params: {
  tenantId: string;
  botId: string;
  from?: string;
  to?: string;
  status?: BookingStatus;
}): Promise<Booking[]> {
  await getConfigOrDefault(params.tenantId, params.botId);
  return listBookingsForBot(params);
}

export async function createBookingForBot(params: {
  tenantId: string;
  botId: string;
  startAt: string;
  contactPhone: string;
  contactName?: string;
  conversationId?: string;
  notes?: string;
  source: BookingSource;
}): Promise<Booking> {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  const startAt = new Date(params.startAt);
  const endAt = new Date(startAt.getTime() + config.slotDurationMinutes * 60 * 1000);
  const now = new Date();
  const minStart = new Date(now.getTime() + config.minNoticeHours * 60 * 60 * 1000);
  if (startAt < minStart) {
    throw new Error("Booking is too soon");
  }

  const rangeStart = new Date(now.toISOString());
  const rangeEnd = new Date(now.getTime() + config.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const bookings = await loadConfirmedBookings(
    params.tenantId,
    params.botId,
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  );

  if (hasBookingOverlap(bookings, startAt, endAt, config.bufferMinutes)) {
    throw new Error("Selected slot is no longer available");
  }

  const available = getSlotsForDate({
    config,
    bookings,
    isoDate: params.startAt.slice(0, 10),
    now,
  });
  if (!available.some((s) => s.startAt === startAt.toISOString())) {
    throw new Error("Selected slot is not available");
  }

  const nowIso = new Date().toISOString();
  const booking: Booking = {
    bookingId: makeBookingId(),
    tenantId: params.tenantId,
    botId: params.botId,
    contactPhone: params.contactPhone,
    ...(params.contactName ? { contactName: params.contactName } : {}),
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    status: "confirmed",
    source: params.source,
    ...(params.notes ? { notes: params.notes } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const provider = getCalendarProvider(config.provider);
  if (provider.createExternalEvent) {
    const externalEventId = await provider.createExternalEvent(booking, config);
    if (externalEventId) booking.externalEventId = externalEventId;
  }

  const created = await createBooking(booking);

  const withReminder = await scheduleBookingReminder(created, config);

  await emitIntegrationEvent(
    params.tenantId,
    "booking.created",
    buildIntegrationPayload({
      event: "booking.created",
      tenantId: params.tenantId,
      data: {
        bookingId: withReminder.bookingId,
        botId: withReminder.botId,
        contactPhone: withReminder.contactPhone,
        contactName: withReminder.contactName ?? "",
        startAt: withReminder.startAt,
        endAt: withReminder.endAt,
        source: withReminder.source,
      },
    })
  );

  return withReminder;
}

export async function updateBookingStatus(params: {
  tenantId: string;
  botId: string;
  bookingId: string;
  status: BookingStatus;
}): Promise<Booking> {
  const existing = await getBooking(params.tenantId, params.bookingId);
  if (!existing || existing.botId !== params.botId) {
    throw new Error("Booking not found");
  }
  const config = await getConfigOrDefault(params.tenantId, params.botId);
  const updated = await updateBooking(params.tenantId, params.bookingId, {
    status: params.status,
  });
  if (!updated) throw new Error("Booking not found");

  let bookingAfterReminder = updated;
  if (params.status === "cancelled") {
    bookingAfterReminder = await cancelBookingReminder(updated);
  }

  if (params.status === "cancelled") {
    const provider = getCalendarProvider(config.provider);
    if (provider.cancelExternalEvent) {
      await provider.cancelExternalEvent(bookingAfterReminder, config);
    }
    await emitIntegrationEvent(
      params.tenantId,
      "booking.cancelled",
      buildIntegrationPayload({
        event: "booking.cancelled",
        tenantId: params.tenantId,
        data: {
          bookingId: bookingAfterReminder.bookingId,
          botId: bookingAfterReminder.botId,
          contactPhone: bookingAfterReminder.contactPhone,
          startAt: bookingAfterReminder.startAt,
          endAt: bookingAfterReminder.endAt,
        },
      })
    );
  }

  return bookingAfterReminder;
}

export async function countEnabledCalendarApps(tenantId: string): Promise<number> {
  return countEnabledCalendars(tenantId);
}

export async function listEnabledCalendarsForTenant(tenantId: string): Promise<CalendarConfig[]> {
  return listEnabledCalendarConfigs(tenantId);
}

export function formatBookingConfirmation(
  booking: Booking,
  config: CalendarConfig
): string {
  const start = new Date(booking.startAt);
  const dateLabel = formatDateLabel(booking.startAt.slice(0, 10), config.timezone);
  const timeLabel = formatSlotLabel(start, config.timezone);
  return `${dateLabel} ${timeLabel}`;
}

export type { WeeklySchedule };
