import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { generateApiKey, hashApiKey, getKeyPrefix } from "../../lib/api-keys/manager.js";
import {
  createApiKey,
  listApiKeysByTenant,
  updateApiKey,
  deleteApiKey,
} from "../../lib/dynamodb/api-key.repository.js";
import {
  listApiKeyUsageLogs,
  countApiKeyUsageByPeriod,
} from "../../lib/dynamodb/api-key-usage.repository.js";
import { listBots } from "../../lib/dynamodb/bot.repository.js";
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  forbidden,
  handleError,
} from "../../lib/http.js";
import type { ApiKey } from "../../types/index.js";

const DEFAULT_RATE_LIMIT_MINUTE = 60;
const DEFAULT_RATE_LIMIT_DAY = 1000;

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(128),
  botId: z.string().uuid(),
  rateLimitPerMinute: z.number().int().min(1).max(600).default(DEFAULT_RATE_LIMIT_MINUTE),
  rateLimitPerDay: z.number().int().min(1).max(100000).default(DEFAULT_RATE_LIMIT_DAY),
  expiresAt: z.string().datetime().optional(),
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(600).optional(),
  rateLimitPerDay: z.number().int().min(1).max(100000).optional(),
});

function safeApiKey(key: ApiKey): Omit<ApiKey, "hashedKey"> {
  const { hashedKey, ...safe } = key;
  void hashedKey;
  return safe;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);

    const method = event.requestContext.http.method;
    const path = event.rawPath ?? "";
    const keyId = event.pathParameters?.keyId;

    if (method === "GET" && path.endsWith("/api-keys/usage")) {
      const keys = await listApiKeysByTenant(auth.tenantId);
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const monthEnd = now.toISOString();

      const usageResults = await Promise.all(
        keys.map(async (key) => {
          const [logs, monthCount] = await Promise.all([
            listApiKeyUsageLogs(auth.tenantId, key.keyId, 5),
            countApiKeyUsageByPeriod(auth.tenantId, key.keyId, monthStart, monthEnd),
          ]);

          const successCount = logs.filter((l) => l.statusCode < 400).length;
          const errorCount = logs.filter((l) => l.statusCode >= 400).length;

          return {
            keyId: key.keyId,
            keyName: key.name,
            prefix: key.prefix,
            totalRequests: monthCount,
            successRequests: successCount,
            errorRequests: errorCount,
            messagesThisMonth: monthCount,
            lastUsedAt: key.lastUsedAt,
          };
        })
      );

      return ok(usageResults);
    }

    if (method === "GET" && keyId && path.includes("/api-keys/") && path.endsWith("/logs")) {
      const keys = await listApiKeysByTenant(auth.tenantId);
      const key = keys.find((k) => k.keyId === keyId);
      if (!key) return notFound("API key not found");

      const logs = await listApiKeyUsageLogs(auth.tenantId, keyId, 20);
      return ok(logs);
    }

    if (method === "GET" && !keyId) {
      const keys = await listApiKeysByTenant(auth.tenantId);
      return ok(keys.map(safeApiKey));
    }

    if (method === "POST" && !keyId) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateApiKeySchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");

      const bots = await listBots(auth.tenantId);
      const bot = bots.find((b) => b.botId === parsed.data.botId);
      if (!bot) return notFound("Bot not found");

      const rawKey = generateApiKey();
      const hashedKey = hashApiKey(rawKey);
      const prefix = getKeyPrefix(rawKey);
      const now = new Date().toISOString();

      const newKey: ApiKey = {
        keyId: randomUUID(),
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        name: parsed.data.name,
        prefix,
        hashedKey,
        scopes: ["messages:send"],
        rateLimitPerMinute: parsed.data.rateLimitPerMinute,
        rateLimitPerDay: parsed.data.rateLimitPerDay,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.expiresAt ? { expiresAt: parsed.data.expiresAt } : {}),
      };

      await createApiKey(newKey);

      return created({
        ...safeApiKey(newKey),
        key: rawKey,
      });
    }

    if (method === "PATCH" && keyId) {
      const keys = await listApiKeysByTenant(auth.tenantId);
      const existing = keys.find((k) => k.keyId === keyId);
      if (!existing) return notFound("API key not found");

      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateApiKeySchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");

      const now = new Date().toISOString();
      const fields: Parameters<typeof updateApiKey>[1] = { updatedAt: now };
      const { name, enabled, rateLimitPerMinute, rateLimitPerDay } = parsed.data;
      if (name !== undefined) fields.name = name;
      if (enabled !== undefined) fields.enabled = enabled;
      if (rateLimitPerMinute !== undefined) fields.rateLimitPerMinute = rateLimitPerMinute;
      if (rateLimitPerDay !== undefined) fields.rateLimitPerDay = rateLimitPerDay;

      const updated = await updateApiKey(existing.hashedKey, fields);

      if (!updated) return notFound("API key not found");
      return ok(safeApiKey(updated));
    }

    if (method === "DELETE" && keyId) {
      const keys = await listApiKeysByTenant(auth.tenantId);
      const existing = keys.find((k) => k.keyId === keyId);
      if (!existing) return notFound("API key not found");
      if (existing.tenantId !== auth.tenantId) return forbidden("Access denied");

      await deleteApiKey(existing.hashedKey);
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
