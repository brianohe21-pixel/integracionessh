import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import {
  extractAuthContext,
  assertAdvisorOrMember,
  assertMemberRole,
  assertTenantAccess,
} from "../../lib/auth/cognito.js";
import { loadBotAndToken } from "../../lib/whatsapp/bot-context.js";
import {
  getCallSettings,
  updateCallSettings,
  sendCallPermissionRequest,
  getCallPermissionStatus,
  initiateCall,
  performCallAction,
  type WhatsAppCallingSettings,
} from "../../lib/whatsapp/calls.js";
import { getCallRecord, listCallsByBot, upsertCallRecord } from "../../lib/dynamodb/call.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { ok, badRequest, notFound, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const UpdateSettingsSchema = z.object({
  calling: z
    .object({
      status: z.enum(["ENABLED", "DISABLED"]).optional(),
      callback_permission_status: z.string().optional(),
      call_icon_visibility: z.string().optional(),
      call_hours: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const PermissionRequestSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/),
  bodyText: z.string().min(1).max(1024).optional(),
});

const SessionSchema = z.object({
  sdp_type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1),
});

const InitiateCallSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/),
  session: SessionSchema.refine((s) => s.sdp_type === "offer", {
    message: "session.sdp_type must be offer when initiating a call",
  }),
});

const CallActionSchema = z.object({
  action: z.enum(["pre_accept", "accept", "reject", "terminate"]),
  session: SessionSchema.optional(),
});

function parseCallingSubPath(rawPath: string, botId: string): string | null {
  const marker = `/bots/${botId}/calling`;
  const idx = rawPath.indexOf(marker);
  if (idx === -1) return null;
  const suffix = rawPath.slice(idx + marker.length).replace(/^\//, "");
  return suffix || null;
}

function isAdvisorSoftphoneRoute(subPath: string | null): boolean {
  return subPath === "calls/initiate" || Boolean(subPath?.match(/^calls\/[^/]+\/action$/));
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const botId = event.pathParameters?.botId;
    if (!botId) return badRequest("botId is required");

    const bot = await getBot(auth.tenantId, botId);
    if (!bot) return notFound("Bot not found");
    assertTenantAccess(auth, bot.tenantId);

    const subPath = parseCallingSubPath(event.rawPath ?? "", botId);
    const callIdParam = event.pathParameters?.callId;
    const userWaIdParam = event.pathParameters?.userWaId;

    if (isAdvisorSoftphoneRoute(subPath)) {
      assertAdvisorOrMember(auth);
    } else {
      assertMemberRole(auth);
    }

    if (method === "GET" && subPath === "settings") {
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId, ENVIRONMENT);
      const settings = await getCallSettings(bot.phoneNumberId, accessToken);
      return ok(settings);
    }

    if (method === "PUT" && subPath === "settings") {
      const parsed = UpdateSettingsSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
      }
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId, ENVIRONMENT);
      const settings = await updateCallSettings(
        bot.phoneNumberId,
        accessToken,
        parsed.data as WhatsAppCallingSettings
      );
      return ok(settings);
    }

    if (method === "GET" && subPath === "calls") {
      const limit = Math.min(parseInt(event.queryStringParameters?.limit ?? "50", 10) || 50, 100);
      const calls = await listCallsByBot(botId, limit);
      return ok(calls);
    }

    if (method === "GET" && callIdParam) {
      const record = await getCallRecord(auth.tenantId, callIdParam);
      if (!record || record.botId !== botId) return notFound("Call not found");
      return ok(record);
    }

    if (method === "POST" && subPath === "calls/permission-request") {
      const parsed = PermissionRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
      }
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId, ENVIRONMENT);
      const result = await sendCallPermissionRequest({
        phoneNumberId: bot.phoneNumberId,
        to: parsed.data.to,
        accessToken,
        ...(parsed.data.bodyText ? { bodyText: parsed.data.bodyText } : {}),
      });
      return ok({ messageId: result.messages[0]?.id ?? null, status: "sent" });
    }

    if (method === "POST" && subPath === "calls/initiate") {
      const parsed = InitiateCallSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
      }
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId, ENVIRONMENT);
      const result = await initiateCall({
        phoneNumberId: bot.phoneNumberId,
        to: parsed.data.to,
        session: parsed.data.session,
        accessToken,
      });
      const callId = result.calls[0]?.id ?? "";
      const now = new Date().toISOString();
      if (callId) {
        await upsertCallRecord({
          callId,
          tenantId: auth.tenantId,
          botId,
          phoneNumber: parsed.data.to,
          direction: "BUSINESS_INITIATED",
          status: "initiated",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      return ok({ callId, status: "initiated", timestamp: now });
    }

    if (method === "POST" && subPath?.endsWith("/action") && callIdParam) {
      const parsed = CallActionSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
      }
      if (
        (parsed.data.action === "pre_accept" || parsed.data.action === "accept") &&
        !parsed.data.session
      ) {
        return badRequest("session is required for pre_accept and accept actions");
      }
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId, ENVIRONMENT);
      await performCallAction({
        phoneNumberId: bot.phoneNumberId,
        callId: callIdParam,
        action: parsed.data.action,
        accessToken,
        ...(parsed.data.session ? { session: parsed.data.session } : {}),
      });
      return ok({ callId: callIdParam, status: parsed.data.action });
    }

    if (method === "GET" && userWaIdParam) {
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId, ENVIRONMENT);
      const permission = await getCallPermissionStatus(
        bot.phoneNumberId,
        userWaIdParam,
        accessToken
      );
      return ok(permission);
    }

    return badRequest("Not found");
  } catch (error) {
    return handleError(error);
  }
}
