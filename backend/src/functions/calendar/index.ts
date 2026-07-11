import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertCanEnableCalendar } from "../../lib/billing/assert-plan.js";
import { listAppsCatalog } from "../../lib/apps/catalog.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  disableCalendar,
  enableCalendar,
  getAvailableSlots,
  getConfigOrDefault,
  listBookings,
  createBookingForBot,
  saveCalendarConfig,
  updateBookingStatus,
} from "../../lib/calendar/calendar.service.js";
import {
  disablePublicCalendarLink,
  enablePublicCalendarLink,
  getPublicLinkStatus,
  rotatePublicCalendarLink,
} from "../../lib/calendar/public-link.js";
import { sendBookingReminder } from "../../lib/calendar/reminder-send.js";
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

const ConfigSchema = z
  .object({
    timezone: z.string().min(1).max(64),
    slotDurationMinutes: z.number().int().min(5).max(480),
    bufferMinutes: z.number().int().min(0).max(120),
    maxAdvanceDays: z.number().int().min(1).max(90),
    minNoticeHours: z.number().int().min(0).max(168),
    weeklySchedule: WeeklyScheduleSchema,
    reminderEnabled: z.boolean().optional(),
    reminderMinutesBefore: z.number().int().min(15).max(10080).optional(),
    reminderChannel: z.enum(["whatsapp_text", "whatsapp_template"]).optional(),
    reminderMessage: z.string().max(500).optional(),
    reminderTemplateName: z.string().max(120).optional(),
    reminderTemplateLanguage: z.string().min(2).max(10).optional(),
    autoCollectPayment: z.boolean().optional(),
    bookingPriceInCents: z.number().int().min(1000).max(100_000_000).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.reminderEnabled) return;
    const channel = data.reminderChannel ?? "whatsapp_text";
    if (channel === "whatsapp_template") {
      if (!data.reminderTemplateName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reminderTemplateName is required",
          path: ["reminderTemplateName"],
        });
      }
      if (!data.reminderTemplateLanguage?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reminderTemplateLanguage is required",
          path: ["reminderTemplateLanguage"],
        });
      }
    } else if (!data.reminderMessage?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reminderMessage is required",
        path: ["reminderMessage"],
      });
    }
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
  event: APIGatewayProxyEventV2WithJWTAuthorizer & {
    action?: string;
    tenantId?: string;
    botId?: string;
    bookingId?: string;
  }
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.action === "send-booking-reminder") {
      const { tenantId, botId, bookingId } = event as {
        action: string;
        tenantId: string;
        botId: string;
        bookingId: string;
      };
      const result = await sendBookingReminder({ tenantId, botId, bookingId });
      return ok(result);
    }

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
      const config = await saveCalendarConfig(
        auth.tenantId,
        botId,
        body as Parameters<typeof saveCalendarConfig>[2]
      );
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

    if (method === "GET" && rawPath === `/calendar/${botId}/public-link`) {
      return ok(await getPublicLinkStatus(auth.tenantId, botId));
    }

    if (method === "POST" && rawPath === `/calendar/${botId}/public-link/enable`) {
      return ok(await enablePublicCalendarLink(auth.tenantId, botId));
    }

    if (method === "POST" && rawPath === `/calendar/${botId}/public-link/disable`) {
      return ok(await disablePublicCalendarLink(auth.tenantId, botId));
    }

    if (method === "POST" && rawPath === `/calendar/${botId}/public-link/rotate-key`) {
      return ok(await rotatePublicCalendarLink(auth.tenantId, botId));
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
      const result = await createBookingForBot({
        tenantId: auth.tenantId,
        botId,
        startAt: body.startAt,
        contactPhone: body.contactPhone,
        ...(body.contactName ? { contactName: body.contactName } : {}),
        ...(body.conversationId ? { conversationId: body.conversationId } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
        source: "manual",
      });
      return ok({ booking: result.booking, ...(result.payment ? { payment: result.payment } : {}) });
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
