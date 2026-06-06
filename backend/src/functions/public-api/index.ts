import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import { hashApiKey } from "../../lib/api-keys/manager.js";
import { checkAndIncrement } from "../../lib/rate-limiter/index.js";
import { getApiKeyByHash, updateApiKey } from "../../lib/dynamodb/api-key.repository.js";
import { logApiKeyUsage } from "../../lib/dynamodb/api-key-usage.repository.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import {
  sendTextMessage,
  sendTemplateMessage,
  getWhatsAppAccessToken,
  type SendTemplateOptions,
} from "../../lib/whatsapp/client.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
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
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function rateLimitHeaders(
  limit: number,
  remaining: number,
  resetIn?: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    ...(resetIn !== undefined ? { "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + resetIn) } : {}),
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
            .array(z.object({ type: z.string(), text: z.string().optional(), image: z.object({ link: z.string() }).optional() }))
            .optional(),
        })
      )
      .optional(),
  }),
});

const SendMessageSchema = z.discriminatedUnion("type", [TextMessageSchema, TemplateMessageSchema]);

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

async function handleSendMessage(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const rawKey = extractApiKey(event);

  if (!rawKey) {
    return unauthorized("Missing API key. Provide X-API-Key header.");
  }

  const hashedKey = hashApiKey(rawKey);
  const apiKey = await getApiKeyByHash(hashedKey);

  if (!apiKey) {
    return unauthorized("Invalid API key.");
  }

  if (!apiKey.enabled) {
    return forbidden("API key is disabled.");
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return forbidden("API key has expired.");
  }

  const rateResult = await checkAndIncrement(
    hashedKey,
    apiKey.rateLimitPerMinute,
    apiKey.rateLimitPerDay
  );

  if (!rateResult.allowed) {
    const limitHeaders = {
      ...CORS_HEADERS,
      ...rateLimitHeaders(
        apiKey.rateLimitPerMinute,
        rateResult.minuteRemaining,
        rateResult.retryAfterSeconds
      ),
      ...(rateResult.retryAfterSeconds !== undefined
        ? { "Retry-After": String(rateResult.retryAfterSeconds) }
        : {}),
    };

    return {
      statusCode: 429,
      headers: limitHeaders,
      body: JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: rateResult.retryAfterSeconds,
        limits: {
          perMinute: {
            limit: apiKey.rateLimitPerMinute,
            remaining: rateResult.minuteRemaining,
          },
          perDay: {
            limit: apiKey.rateLimitPerDay,
            remaining: rateResult.dayRemaining,
          },
        },
      }),
    };
  }

  const body = JSON.parse(event.body ?? "{}");
  const parsed = SendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const bot = await getBot(apiKey.tenantId, apiKey.botId);
  if (!bot) {
    return notFound("Bot associated with this API key not found.");
  }

  if (bot.status !== "active") {
    return forbidden("Bot is inactive.");
  }

  const accessToken = await getWhatsAppAccessToken(apiKey.tenantId, ENVIRONMENT);

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
    statusCode = 502;
    const durationMs = Date.now() - startMs;
    const now = new Date().toISOString();
    await Promise.allSettled([
      logApiKeyUsage({
        logId: randomUUID(),
        tenantId: apiKey.tenantId,
        keyId: apiKey.keyId,
        endpoint: "POST /v1/messages",
        method: "POST",
        statusCode,
        durationMs,
        maskedPhone: maskPhone(parsed.data.to),
        createdAt: now,
      }),
      updateApiKey(hashedKey, { lastUsedAt: now, updatedAt: now }),
    ]);
    throw err;
  }

  const durationMs = Date.now() - startMs;
  const now = new Date().toISOString();

  await Promise.allSettled([
    logApiKeyUsage({
      logId: randomUUID(),
      tenantId: apiKey.tenantId,
      keyId: apiKey.keyId,
      endpoint: "POST /v1/messages",
      method: "POST",
      statusCode,
      durationMs,
      messageId: messageId ?? undefined,
      maskedPhone: maskPhone(parsed.data.to),
      createdAt: now,
    }),
    updateApiKey(hashedKey, { lastUsedAt: now, updatedAt: now }),
  ]);

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      ...rateLimitHeaders(
        apiKey.rateLimitPerMinute,
        rateResult.minuteRemaining - 1,
        undefined
      ),
    },
    body: JSON.stringify({
      messageId,
      status: "sent",
      timestamp: now,
    }),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    if (method === "POST") {
      const path = event.rawPath ?? "";
      if (path === "/v1/messages" || path.endsWith("/v1/messages")) {
        return await handleSendMessage(event);
      }
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
