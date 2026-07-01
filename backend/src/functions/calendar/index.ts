import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertCanEnableCalendar } from "../../lib/billing/assert-plan.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  disableCalendar,
  enableCalendar,
  getAvailableSlots,
  getConfigOrDefault,
  listAppsCatalog,
  listBookings,
  createBookingForBot,
  saveCalendarConfig,
  updateBookingStatus,
} from "../../lib/calendar/calendar.service.js";
import { ok, badRequest, handleError } from "../../lib/http.js";
import type { BookingStatus } from "../../types/index.js";

const TimeRangeSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const WeeklyScheduleSchema = z.object({
  monday: z.array(TimeRangeSchema),
  tuesday: z.array(TimeRangeSchema),
  wednesday: z.array(TimeRangeSchema),
  thursday: z.array(TimeRangeSchema),
  friday: z.array(TimeRangeSchema),
  saturday: z.array(TimeRangeSchema),
  sunday: z.array(TimeRangeSchema),
});

const ConfigSchema = z.object({
  timezone: z.string().min(1).max(64),
  slotDurationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120),
  maxAdvanceDays: z.number().int().min(1).max(90),
  minNoticeHours: z.number().int().min(0).max(168),
  weeklySchedule: WeeklyScheduleSchema,
});

const CreateBookingSchema = z.object({
  startAt: z.string().datetime(),
  contactPhone: z.string().min(8).max(20),
  contactName: z.string().max(120).optional(),
  conversationId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

const PatchBookingSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
});

async function assertBotBelongsToTenant(tenantId: string, botId: string): Promise<void> {
  const bot = await getBot(tenantId, botId);
  if (!bot) throw new Error("Bot not found");
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath;
    const botId = event.pathParameters?.botId;
    const bookingId = event.pathParameters?.bookingId;

    if (method === "GET" && rawPath === "/apps") {
      return ok(await listAppsCatalog(auth.tenantId));
    }

    if (!botId) {
      return badRequest("botId is required");
    }

    await assertBotBelongsToTenant(auth.tenantId, botId);

    if (method === "GET" && rawPath === `/calendar/${botId}/config`) {
      return ok({ config: await getConfigOrDefault(auth.tenantId, botId) });
    }

    if (method === "PUT" && rawPath === `/calendar/${botId}/config`) {
      const body = ConfigSchema.parse(JSON.parse(event.body ?? "{}"));
      const config = await saveCalendarConfig(auth.tenantId, botId, body);
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/calendar/${botId}/enable`) {
      const tenant = await getTenant(auth.tenantId);
      if (!tenant) throw new Error("Tenant not found");
      await assertCanEnableCalendar(tenant, botId);
      const config = await enableCalendar(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/calendar/${botId}/disable`) {
      const config = await disableCalendar(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "GET" && rawPath === `/calendar/${botId}/slots`) {
      const from = event.queryStringParameters?.from;
      const to = event.queryStringParameters?.to;
      const slots = await getAvailableSlots({
        tenantId: auth.tenantId,
        botId,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      return ok({ slots });
    }

    if (method === "GET" && rawPath === `/calendar/${botId}/bookings`) {
      const from = event.queryStringParameters?.from;
      const to = event.queryStringParameters?.to;
      const status = event.queryStringParameters?.status as BookingStatus | undefined;
      const bookings = await listBookings({
        tenantId: auth.tenantId,
        botId,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(status ? { status } : {}),
      });
      return ok({ bookings });
    }

    if (method === "POST" && rawPath === `/calendar/${botId}/bookings`) {
      const body = CreateBookingSchema.parse(JSON.parse(event.body ?? "{}"));
      const booking = await createBookingForBot({
        tenantId: auth.tenantId,
        botId,
        startAt: body.startAt,
        contactPhone: body.contactPhone,
        ...(body.contactName ? { contactName: body.contactName } : {}),
        ...(body.conversationId ? { conversationId: body.conversationId } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
        source: "manual",
      });
      return ok({ booking });
    }

    if (method === "PATCH" && bookingId && rawPath === `/calendar/${botId}/bookings/${bookingId}`) {
      const body = PatchBookingSchema.parse(JSON.parse(event.body ?? "{}"));
      const booking = await updateBookingStatus({
        tenantId: auth.tenantId,
        botId,
        bookingId,
        status: body.status,
      });
      return ok({ booking });
    }

    return badRequest("Not found");
  } catch (error) {
    return handleError(error);
  }
}
