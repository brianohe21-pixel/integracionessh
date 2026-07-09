import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { updateBooking } from "../dynamodb/booking.repository.js";
import type { Booking, CalendarConfig } from "../../types/index.js";
import { formatDateLabel, formatSlotLabel } from "./slot-engine.js";

const scheduler = new SchedulerClient({});
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? "";
const CALENDAR_FUNCTION_ARN = process.env.CALENDAR_FUNCTION_ARN ?? "";

export const DEFAULT_REMINDER_MESSAGE =
  "Hola {{name}}, te recordamos tu cita el {{date}} a las {{time}}.";

export function bookingReminderScheduleName(bookingId: string): string {
  return `booking-reminder-${bookingId}`;
}

export function computeReminderAt(startAt: string, minutesBefore: number): Date {
  return new Date(new Date(startAt).getTime() - minutesBefore * 60 * 1000);
}

export function renderReminderMessage(
  template: string,
  params: { name: string; date: string; time: string }
): string {
  return template
    .replace(/\{\{name\}\}/g, params.name)
    .replace(/\{\{date\}\}/g, params.date)
    .replace(/\{\{time\}\}/g, params.time);
}

export function reminderTemplateParams(
  booking: Booking,
  config: CalendarConfig
): { name: string; date: string; time: string } {
  const start = new Date(booking.startAt);
  return {
    name: booking.contactName?.trim() || "Cliente",
    date: formatDateLabel(booking.startAt.slice(0, 10), config.timezone),
    time: formatSlotLabel(start, config.timezone),
  };
}

export function buildReminderText(booking: Booking, config: CalendarConfig): string {
  const params = reminderTemplateParams(booking, config);
  const template =
    config.reminderMessage?.trim() ||
    DEFAULT_REMINDER_MESSAGE;
  return renderReminderMessage(template, params);
}

export async function scheduleBookingReminder(
  booking: Booking,
  config: CalendarConfig
): Promise<Booking> {
  if (!config.reminderEnabled) {
    return booking;
  }

  const minutesBefore = config.reminderMinutesBefore ?? 60;
  const reminderAt = computeReminderAt(booking.startAt, minutesBefore);
  const now = new Date();

  if (reminderAt <= now) {
    const skipped = await updateBooking(booking.tenantId, booking.bookingId, {
      reminderStatus: "skipped",
    });
    return skipped ?? booking;
  }

  if (!SCHEDULER_ROLE_ARN || !CALENDAR_FUNCTION_ARN) {
    console.warn("Scheduler not configured; skipping booking reminder");
    const skipped = await updateBooking(booking.tenantId, booking.bookingId, {
      reminderStatus: "skipped",
    });
    return skipped ?? booking;
  }

  const scheduleName = bookingReminderScheduleName(booking.bookingId);
  const scheduleExpression = `at(${reminderAt.toISOString().slice(0, 19)})`;

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: "default",
      ScheduleExpression: scheduleExpression,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: { Mode: "OFF" },
      Target: {
        Arn: CALENDAR_FUNCTION_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          action: "send-booking-reminder",
          tenantId: booking.tenantId,
          botId: booking.botId,
          bookingId: booking.bookingId,
        }),
      },
      ActionAfterCompletion: "DELETE",
    })
  );

  const updated = await updateBooking(booking.tenantId, booking.bookingId, {
    reminderScheduleName: scheduleName,
    reminderStatus: "scheduled",
  });
  return updated ?? booking;
}

export async function cancelBookingReminder(booking: Booking): Promise<Booking> {
  if (!booking.reminderScheduleName) {
    if (booking.reminderStatus === "scheduled") {
      const updated = await updateBooking(booking.tenantId, booking.bookingId, {
        reminderStatus: "cancelled",
      });
      return updated ?? booking;
    }
    return booking;
  }

  if (SCHEDULER_ROLE_ARN) {
    try {
      await scheduler.send(
        new DeleteScheduleCommand({
          Name: booking.reminderScheduleName,
          GroupName: "default",
        })
      );
    } catch {
      // Schedule may already have fired or been deleted
    }
  }

  const updated = await updateBooking(booking.tenantId, booking.bookingId, {
    reminderStatus: "cancelled",
  });
  return updated ?? booking;
}
