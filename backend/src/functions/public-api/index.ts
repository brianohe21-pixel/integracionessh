import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import { hashApiKey } from "../../lib/api-keys/manager.js";
import { assertApiKeyScope, API_KEY_SCOPES } from "../../lib/api-keys/scopes.js";
import { checkAndIncrement } from "../../lib/rate-limiter/index.js";
import { getApiKeyByHash, updateApiKey } from "../../lib/dynamodb/api-key.repository.js";
import { logApiKeyUsage } from "../../lib/dynamodb/api-key-usage.repository.js";
import { getCallRecord, upsertCallRecord } from "../../lib/dynamodb/call.repository.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import {
  sendTextMessage,
  sendTemplateMessage,
  getWhatsAppAccessToken,
  type SendTemplateOptions,
} from "../../lib/whatsapp/client.js";
import {
  initiateCall,
  performCallAction,
  getCallSettings,
  updateCallSettings,
  sendCallPermissionRequest,
  type WhatsAppCallingSettings,
} from "../../lib/whatsapp/calls.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import type { ApiKey } from "../../types/index.js";
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  handleError,
} from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const CORS_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
};

function rateLimitHeaders(
  limit: number,
  remaining: number,
  resetIn?: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    ...(resetIn !== undefined
      ? { "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + resetIn) }
      : {}),
  };
}

const TextMessageSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/, "Phone number must contain only digits"),
  type: z.literal("text"),
  text: z.string().min(1).max(1024),
});

const TemplateMessageSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/, "Phone number must contain only digits"),
  type: z.literal("template"),
  template: z.object({
    name: z.string().min(1).max(512),
    language: z.string().min(2).max(20),
    components: z
      .array(
        z.object({
          type: z.string(),
          parameters: z
            .array(
              z.object({
                type: z.string(),
                text: z.string().optional(),
                image: z.object({ link: z.string() }).optional(),
              })
            )
            .optional(),
        })
      )
      .optional(),
  }),
});

const SendMessageSchema = z.discriminatedUnion("type", [TextMessageSchema, TemplateMessageSchema]);

const SessionSchema = z.object({
  sdp_type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1),
});

const InitiateCallSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/),
  session: SessionSchema.refine((s) => s.sdp_type === "offer", {
    message: "session.sdp_type must be offer when initiating a call",
  }),
  biz_opaque_callback_data: z.string().max(512).optional(),
});

const CallActionSchema = z.object({
  action: z.enum(["pre_accept", "accept", "reject", "terminate"]),
  session: SessionSchema.optional(),
});

const UpdateCallSettingsSchema = z.object({
  calling: z.record(z.unknown()).optional(),
});

const PermissionRequestSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/),
  bodyText: z.string().min(1).max(1024).optional(),
});

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return phone.slice(0, 3) + "***" + phone.slice(-3);
}

function extractApiKey(event: APIGatewayProxyEventV2): string | null {
  const header =
    event.headers?.["x-api-key"] ??
    event.headers?.["X-API-Key"] ??
    event.headers?.["X-Api-Key"] ??
    event.headers?.["authorization"]?.replace(/^Bearer\s+/i, "") ??
    null;
  return header ?? null;
}

interface AuthResult {
  apiKey: ApiKey;
  hashedKey: string;
  rateResult: Awaited<ReturnType<typeof checkAndIncrement>>;
}

async function authenticateApiKey(
  event: APIGatewayProxyEventV2
): Promise<AuthResult | APIGatewayProxyResultV2> {
  const rawKey = extractApiKey(event);
  if (!rawKey) {
    return unauthorized("Missing API key. Provide X-API-Key header.");
  }

  const hashedKey = hashApiKey(rawKey);
  const apiKey = await getApiKeyByHash(hashedKey);
  if (!apiKey) return unauthorized("Invalid API key.");
  if (!apiKey.enabled) return forbidden("API key is disabled.");
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return forbidden("API key has expired.");
  }

  const rateResult = await checkAndIncrement(
    hashedKey,
    apiKey.rateLimitPerMinute,
    apiKey.rateLimitPerDay
  );

  if (!rateResult.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...CORS_HEADERS,
        ...rateLimitHeaders(
          apiKey.rateLimitPerMinute,
          rateResult.minuteRemaining,
          rateResult.retryAfterSeconds
        ),
        ...(rateResult.retryAfterSeconds !== undefined
          ? { "Retry-After": String(rateResult.retryAfterSeconds) }
          : {}),
      },
      body: JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: rateResult.retryAfterSeconds,
      }),
    };
  }

  return { apiKey, hashedKey, rateResult };
}

function isAuthResult(
  value: AuthResult | APIGatewayProxyResultV2
): value is AuthResult {
  return typeof value === "object" && value !== null && "apiKey" in value;
}

function successHeaders(apiKey: ApiKey, rateResult: AuthResult["rateResult"]) {
  return {
    ...CORS_HEADERS,
    ...rateLimitHeaders(apiKey.rateLimitPerMinute, rateResult.minuteRemaining - 1),
  };
}

async function logUsage(params: {
  apiKey: ApiKey;
  hashedKey: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  messageId?: string;
  callId?: string;
  maskedPhone?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await Promise.allSettled([
    logApiKeyUsage({
      logId: randomUUID(),
      tenantId: params.apiKey.tenantId,
      keyId: params.apiKey.keyId,
      endpoint: params.endpoint,
      method: params.method,
      statusCode: params.statusCode,
      durationMs: params.durationMs,
      createdAt: now,
      ...(params.messageId ? { messageId: params.messageId } : {}),
      ...(params.callId ? { callId: params.callId } : {}),
      ...(params.maskedPhone ? { maskedPhone: params.maskedPhone } : {}),
    }),
    updateApiKey(params.hashedKey, { lastUsedAt: now, updatedAt: now }),
  ]);
}

async function loadActiveBot(apiKey: ApiKey) {
  const bot = await getBot(apiKey.tenantId, apiKey.botId);
  if (!bot) throw Object.assign(new Error("Bot associated with this API key not found."), { statusCode: 404 });
  if (bot.status !== "active") throw Object.assign(new Error("Bot is inactive."), { statusCode: 403 });
  const accessToken = await getWhatsAppAccessToken(apiKey.tenantId, ENVIRONMENT);
  return { bot, accessToken };
}

async function handleSendMessage(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.messagesSend);

  const body = JSON.parse(event.body ?? "{}");
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const { bot, accessToken } = await loadActiveBot(apiKey);
  let messageId: string | null = null;
  let statusCode = 200;

  try {
    const data = parsed.data;
    if (data.type === "text") {
      const result = await sendTextMessage({
        phoneNumberId: bot.phoneNumberId,
        to: data.to,
        text: data.text,
        accessToken,
      });
      messageId = result.messages[0]?.id ?? null;
    } else {
      const templateOptions: SendTemplateOptions = {
        phoneNumberId: bot.phoneNumberId,
        to: data.to,
        templateName: data.template.name,
        language: data.template.language,
        accessToken,
      };
      if (data.template.components?.length) {
        templateOptions.components = data.template.components as NonNullable<
          SendTemplateOptions["components"]
        >;
      }
      const result = await sendTemplateMessage(templateOptions);
      messageId = result.messages[0]?.id ?? null;
    }
    await incrementMessages(apiKey.tenantId);
  } catch (err) {
    await logUsage({
      apiKey,
      hashedKey,
      endpoint: "POST /v1/messages",
      method: "POST",
      statusCode: 502,
      durationMs: Date.now() - startMs,
      maskedPhone: maskPhone(parsed.data.to),
    });
    throw err;
  }

  const now = new Date().toISOString();
  await logUsage({
    apiKey,
    hashedKey,
    endpoint: "POST /v1/messages",
    method: "POST",
    statusCode,
    durationMs: Date.now() - startMs,
    ...(messageId ? { messageId } : {}),
    maskedPhone: maskPhone(parsed.data.to),
  });

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify({ messageId, status: "sent", timestamp: now }),
  };
}

async function handleInitiateCall(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.callsInitiate);

  const parsed = InitiateCallSchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const { bot, accessToken } = await loadActiveBot(apiKey);
  const result = await initiateCall({
    phoneNumberId: bot.phoneNumberId,
    to: parsed.data.to,
    session: parsed.data.session,
    accessToken,
    ...(parsed.data.biz_opaque_callback_data
      ? { bizOpaqueCallbackData: parsed.data.biz_opaque_callback_data }
      : {}),
  });

  const callId = result.calls[0]?.id ?? "";
  const now = new Date().toISOString();
  if (callId) {
    await upsertCallRecord({
      callId,
      tenantId: apiKey.tenantId,
      botId: apiKey.botId,
      phoneNumber: parsed.data.to,
      direction: "BUSINESS_INITIATED",
      status: "initiated",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(parsed.data.biz_opaque_callback_data
        ? { bizOpaqueCallbackData: parsed.data.biz_opaque_callback_data }
        : {}),
    });
  }

  await logUsage({
    apiKey,
    hashedKey,
    endpoint: "POST /v1/calls",
    method: "POST",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    ...(callId ? { callId } : {}),
    maskedPhone: maskPhone(parsed.data.to),
  });

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify({ callId, status: "initiated", timestamp: now }),
  };
}

async function handleCallAction(
  event: APIGatewayProxyEventV2,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.callsManage);

  const parsed = CallActionSchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  if (
    (parsed.data.action === "pre_accept" || parsed.data.action === "accept") &&
    !parsed.data.session
  ) {
    return badRequest("session is required for pre_accept and accept actions");
  }

  const { bot, accessToken } = await loadActiveBot(apiKey);
  await performCallAction({
    phoneNumberId: bot.phoneNumberId,
    callId,
    action: parsed.data.action,
    accessToken,
    ...(parsed.data.session ? { session: parsed.data.session } : {}),
  });

  await logUsage({
    apiKey,
    hashedKey,
    endpoint: "POST /v1/calls/{callId}",
    method: "POST",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    callId,
  });

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify({ callId, action: parsed.data.action, success: true }),
  };
}

async function handleGetCall(
  event: APIGatewayProxyEventV2,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.callsManage);

  const record = await getCallRecord(apiKey.tenantId, callId);
  if (!record || record.botId !== apiKey.botId) {
    return notFound("Call not found");
  }

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify(record),
  };
}

async function handleGetCallSettings(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.callsSettings);

  const { bot, accessToken } = await loadActiveBot(apiKey);
  const settings = await getCallSettings(bot.phoneNumberId, accessToken);

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify(settings),
  };
}

async function handleUpdateCallSettings(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.callsSettings);

  const parsed = UpdateCallSettingsSchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const { bot, accessToken } = await loadActiveBot(apiKey);
  const settings = await updateCallSettings(
    bot.phoneNumberId,
    accessToken,
    parsed.data as WhatsAppCallingSettings
  );

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify(settings),
  };
}

async function handlePermissionRequest(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const auth = await authenticateApiKey(event);
  if (!isAuthResult(auth)) return auth;

  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.callsInitiate);

  const parsed = PermissionRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const { bot, accessToken } = await loadActiveBot(apiKey);
  const result = await sendCallPermissionRequest({
    phoneNumberId: bot.phoneNumberId,
    to: parsed.data.to,
    accessToken,
    ...(parsed.data.bodyText ? { bodyText: parsed.data.bodyText } : {}),
  });
  const messageId = result.messages[0]?.id;

  await logUsage({
    apiKey,
    hashedKey,
    endpoint: "POST /v1/calls/permission-request",
    method: "POST",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    ...(messageId ? { messageId } : {}),
    maskedPhone: maskPhone(parsed.data.to),
  });

  return {
    statusCode: 200,
    headers: successHeaders(apiKey, rateResult),
    body: JSON.stringify({
      messageId: messageId ?? null,
      status: "sent",
    }),
  };
}

function extractCallIdFromPath(path: string): string | null {
  const match = path.match(/\/v1\/calls\/([^/]+)$/);
  if (!match?.[1]) return null;
  if (match[1] === "settings" || match[1] === "permission-request") return null;
  return decodeURIComponent(match[1]);
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath ?? "";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    if (path.endsWith("/v1/messages") && method === "POST") {
      return await handleSendMessage(event);
    }
    if (path.endsWith("/v1/calls") && method === "POST") {
      return await handleInitiateCall(event);
    }
    if (path.endsWith("/v1/calls/settings") && method === "GET") {
      return await handleGetCallSettings(event);
    }
    if (path.endsWith("/v1/calls/settings") && method === "PUT") {
      return await handleUpdateCallSettings(event);
    }
    if (path.endsWith("/v1/calls/permission-request") && method === "POST") {
      return await handlePermissionRequest(event);
    }

    const callId = extractCallIdFromPath(path);
    if (callId && method === "POST") {
      return await handleCallAction(event, callId);
    }
    if (callId && method === "GET") {
      return await handleGetCall(event, callId);
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Route not found" }),
    };
  } catch (error) {
    return handleError(error);
  }
}
