import type { Booking, CalendarConfig } from "../../types/index.js";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  resolveGoogleMeetingLink,
} from "./client.js";
import { resolveGoogleCalendarAccessToken } from "./token.js";

function buildEventSummary(booking: Booking): string {
  const name = booking.contactName?.trim() || booking.contactPhone;
  return `Appointment: ${name}`;
}

function buildEventDescription(booking: Booking): string {
  const lines = [
    `Phone: ${booking.contactPhone}`,
    ...(booking.contactName ? [`Name: ${booking.contactName}`] : []),
    ...(booking.notes ? [`Notes: ${booking.notes}`] : []),
    `Booking ID: ${booking.bookingId}`,
  ];
  return lines.join("\n");
}

export class GoogleCalendarProvider {
  async createExternalEvent(
    booking: Booking,
    config: CalendarConfig
  ): Promise<{ externalEventId: string; meetingLink?: string } | undefined> {
    if (!config.googleCalendarId) {
      throw new Error("Google Calendar is not selected");
    }

    const environment = process.env.ENVIRONMENT ?? "dev";
    const accessToken = await resolveGoogleCalendarAccessToken(
      config.tenantId,
      config.botId,
      environment
    );

    const event = await createGoogleCalendarEvent(accessToken, config.googleCalendarId, {
      summary: buildEventSummary(booking),
      description: buildEventDescription(booking),
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: config.timezone,
      requestId: booking.bookingId,
      privateExtendedProperties: {
        bookingId: booking.bookingId,
        botId: config.botId,
        tenantId: config.tenantId,
      },
    });
    const meetingLink = resolveGoogleMeetingLink(event);
    return {
      externalEventId: event.id,
      ...(meetingLink ? { meetingLink } : {}),
    };
  }

  async cancelExternalEvent(booking: Booking, config: CalendarConfig): Promise<void> {
    if (!booking.externalEventId || !config.googleCalendarId) return;

    const environment = process.env.ENVIRONMENT ?? "dev";
    const accessToken = await resolveGoogleCalendarAccessToken(
      config.tenantId,
      config.botId,
      environment
    );
    await deleteGoogleCalendarEvent(
      accessToken,
      config.googleCalendarId,
      booking.externalEventId
    );
  }
}
