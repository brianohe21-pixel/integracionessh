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
  BookingPaymentStatus,
  BookingSource,
  BookingStatus,
  CalendarConfig,
  WeeklySchedule,
} from "../../types/index.js";
import { DEFAULT_WEEKLY_SCHEDULE } from "../../types/index.js";
import { getPaymentsConfig } from "../dynamodb/payments-config.repository.js";
import { createPaymentRequest } from "../payments/payments.service.js";
import { resolveBookingAmountInCents } from "./payment.js";
import { getCalendarProvider } from "./provider.js";
import {
  formatDateLabel,
  formatSlotLabel,
  generateAvailableSlots,
  getAvailableDates,
  getSchedulableDates,
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
      | "autoCollectPayment"
      | "bookingPriceInCents"
      | "waitlistEnabled"
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

async function loadSlotBlockingBookings(
  tenantId: string,
  botId: string,
  from?: string,
  to?: string
): Promise<Booking[]> {
  const bookings = await listBookingsForBot({
    tenantId,
    botId,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    status: "confirmed",
  });
  return bookings.filter((booking) => bookingBlocksSlot(booking));
}

function bookingBlocksSlot(booking: Booking): boolean {
  if (booking.status !== "confirmed") return false;
  if (!booking.paymentStatus || booking.paymentStatus === "pending") return true;
  return booking.paymentStatus === "paid" || booking.paymentStatus === "not_required";
}

async function emitBookingCreated(booking: Booking, tenantId: string): Promise<void> {
  await emitIntegrationEvent(
    tenantId,
    "booking.created",
    buildIntegrationPayload({
      event: "booking.created",
      tenantId,
      data: {
        bookingId: booking.bookingId,
        botId: booking.botId,
        contactPhone: booking.contactPhone,
        contactName: booking.contactName ?? "",
        startAt: booking.startAt,
        endAt: booking.endAt,
        source: booking.source,
        ...(booking.amountInCents ? { amountInCents: booking.amountInCents } : {}),
        ...(booking.paymentStatus ? { paymentStatus: booking.paymentStatus } : {}),
      },
    })
  );
}

export async function finalizeBookingAfterPayment(params: {
  tenantId: string;
  bookingId: string;
  environment: string;
}): Promise<Booking | null> {
  const booking = await getBooking(params.tenantId, params.bookingId);
  if (!booking || booking.paymentStatus !== "pending") return booking;

  const config = await getConfigOrDefault(params.tenantId, booking.botId);
  const updated = await updateBooking(params.tenantId, params.bookingId, {
    paymentStatus: "paid",
  });
  if (!updated) return null;

  const provider = getCalendarProvider(config.provider);
  if (provider.createExternalEvent && !updated.externalEventId) {
    const externalEventId = await provider.createExternalEvent(updated, config);
    if (externalEventId) {
      const withExternal = await updateBooking(params.tenantId, params.bookingId, {
        externalEventId,
      });
      if (withExternal) {
        const withReminder = await scheduleBookingReminder(withExternal, config);
        await emitBookingCreated(withReminder, params.tenantId);
        return withReminder;
      }
    }
  }

  const withReminder = await scheduleBookingReminder(updated, config);
  await emitBookingCreated(withReminder, params.tenantId);
  return withReminder;
}

export async function cancelBookingForFailedPayment(params: {
  tenantId: string;
  bookingId: string;
}): Promise<Booking | null> {
  const booking = await getBooking(params.tenantId, params.bookingId);
  if (!booking || booking.status === "cancelled") return booking;

  const config = await getConfigOrDefault(params.tenantId, booking.botId);
  const updated = await updateBooking(params.tenantId, params.bookingId, {
    status: "cancelled",
  });
  if (!updated) return null;

  let bookingAfterReminder = await cancelBookingReminder(updated);
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
  return bookingAfterReminder;
}

async function loadConfirmedBookings(
  tenantId: string,
  botId: string,
  from?: string,
  to?: string
): Promise<Booking[]> {
  return loadSlotBlockingBookings(tenantId, botId, from, to);
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

export async function getBookingSchedulableDates(params: {
  tenantId: string;
  botId: string;
  maxDays: number;
}) {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  const now = new Date();
  return getSchedulableDates({
    config,
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

export interface CreateBookingResult {
  booking: Booking;
  payment?: {
    paymentId: string;
    checkoutUrl: string;
    amountInCents: number;
    reference: string;
  };
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
  environment?: string;
  sendPaymentWhatsApp?: boolean;
}): Promise<CreateBookingResult> {
  const config = await requireEnabledCalendar(params.tenantId, params.botId);
  const environment = params.environment ?? process.env.ENVIRONMENT ?? "dev";
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

  const paymentsConfig = await getPaymentsConfig(params.tenantId, params.botId);
  const amountInCents = resolveBookingAmountInCents(config, paymentsConfig);
  const requiresPayment = Boolean(amountInCents && paymentsConfig?.enabled);
  const paymentStatus: BookingPaymentStatus = requiresPayment ? "pending" : "not_required";

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
    paymentStatus,
    ...(requiresPayment && amountInCents ? { amountInCents } : {}),
    ...(params.notes ? { notes: params.notes } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (!requiresPayment) {
    const provider = getCalendarProvider(config.provider);
    if (provider.createExternalEvent) {
      const externalEventId = await provider.createExternalEvent(booking, config);
      if (externalEventId) booking.externalEventId = externalEventId;
    }
  }

  const created = await createBooking(booking);

  if (!requiresPayment || !amountInCents) {
    const withReminder = await scheduleBookingReminder(created, config);
    await emitBookingCreated(withReminder, params.tenantId);
    return { booking: withReminder };
  }

  const label = formatBookingConfirmation(created, config);
  const payment = await createPaymentRequest({
    tenantId: params.tenantId,
    botId: params.botId,
    amountInCents,
    description: `Cita ${label}`,
    contactPhone: params.contactPhone,
    ...(params.contactName ? { contactName: params.contactName } : {}),
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    source: "calendar_booking",
    bookingId: created.bookingId,
    environment,
    sendWhatsApp: params.sendPaymentWhatsApp ?? params.source !== "public_link",
  });

  const withPayment = await updateBooking(params.tenantId, created.bookingId, {
    paymentId: payment.paymentId,
  });
  if (!withPayment) throw new Error("Failed to link payment to booking");

  return {
    booking: withPayment,
    payment: {
      paymentId: payment.paymentId,
      checkoutUrl: payment.checkoutUrl,
      amountInCents: payment.amountInCents,
      reference: payment.reference,
    },
  };
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
