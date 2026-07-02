import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { getResolvedTenantBranding } from "../../lib/branding/service.js";
import {
  createBookingForBot,
  formatBookingConfirmation,
  getBookingDates,
  getBookingSlotsForDate,
} from "../../lib/calendar/calendar.service.js";
import { resolvePublicCalendarContext } from "../../lib/calendar/public-link.js";
import { ok, badRequest, created, handleError } from "../../lib/http.js";

const CreatePublicBookingSchema = z.object({
  startAt: z.string().datetime(),
  contactPhone: z.string().min(8).max(20),
  contactName: z.string().min(1).max(120),
  notes: z.string().max(500).optional(),
});

function parseSubPath(rawPath: string, publicKey: string): string[] {
  const prefix = `/public/calendar/${publicKey}`;
  const suffix = rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : "";
  return suffix.replace(/^\//, "").split("/").filter(Boolean);
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const publicKey = event.pathParameters?.publicKey;
    if (!publicKey) return badRequest("publicKey is required");

    const sub = parseSubPath(rawPath, publicKey);

    if (method === "GET" && sub.length === 0) {
      const ctx = await resolvePublicCalendarContext(publicKey);
      const tenant = await getTenant(ctx.tenantId);
      const branding = tenant ? await getResolvedTenantBranding(tenant) : undefined;
      return ok({
        botName: ctx.botName,
        timezone: ctx.config.timezone,
        maxAdvanceDays: ctx.config.maxAdvanceDays,
        slotDurationMinutes: ctx.config.slotDurationMinutes,
        branding: branding
          ? {
              brandName: branding.brandName,
              primaryColor: branding.primaryColor,
              logoUrl: branding.logoUrl,
            }
          : undefined,
      });
    }

    if (method === "GET" && sub[0] === "dates") {
      const ctx = await resolvePublicCalendarContext(publicKey);
      const dates = await getBookingDates({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        maxDays: ctx.config.maxAdvanceDays,
      });
      return ok({ dates });
    }

    if (method === "GET" && sub[0] === "slots") {
      const ctx = await resolvePublicCalendarContext(publicKey);
      const date = event.queryStringParameters?.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return badRequest("date query parameter is required (YYYY-MM-DD)");
      }
      const slots = await getBookingSlotsForDate({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        isoDate: date,
      });
      return ok({ slots });
    }

    if (method === "POST" && sub[0] === "bookings") {
      const ctx = await resolvePublicCalendarContext(publicKey);
      const body = CreatePublicBookingSchema.parse(JSON.parse(event.body ?? "{}"));
      const booking = await createBookingForBot({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        startAt: body.startAt,
        contactPhone: body.contactPhone,
        contactName: body.contactName,
        ...(body.notes ? { notes: body.notes } : {}),
        source: "public_link",
      });
      const label = formatBookingConfirmation(booking, ctx.config);
      return created({
        booking: {
          bookingId: booking.bookingId,
          startAt: booking.startAt,
          endAt: booking.endAt,
          label,
        },
      });
    }

    return badRequest("Not found");
  } catch (error) {
    return handleError(error);
  }
}
