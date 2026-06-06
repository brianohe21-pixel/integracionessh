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
  summarizeApiKeyUsageByPeriod,
} from "../../lib/dynamodb/api-key-usage.repository.js";
import { listBots } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { getPlanLimits } from "../../lib/billing/plan-limits.js";
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

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(128),
  botId: z.string().uuid(),
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
});

type ApiKeyPublic = Omit<ApiKey, "hashedKey" | "rateLimitPerMinute" | "rateLimitPerDay">;

function safeApiKey(key: ApiKey): ApiKeyPublic {
  const { hashedKey, rateLimitPerMinute, rateLimitPerDay, ...safe } = key;
  void hashedKey;
  void rateLimitPerMinute;
  void rateLimitPerDay;
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
          const monthSummary = await summarizeApiKeyUsageByPeriod(
            auth.tenantId,
            key.keyId,
            monthStart,
            monthEnd
          );

          return {
            keyId: key.keyId,
            keyName: key.name,
            prefix: key.prefix,
            totalRequests: monthSummary.total,
            successRequests: monthSummary.success,
            errorRequests: monthSummary.error,
            messagesThisMonth: monthSummary.total,
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

      const [bots, tenant] = await Promise.all([
        listBots(auth.tenantId),
        getTenant(auth.tenantId),
      ]);
      const bot = bots.find((b) => b.botId === parsed.data.botId);
      if (!bot) return notFound("Bot not found");

      const planLimits = getPlanLimits(tenant?.plan);

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
        rateLimitPerMinute: planLimits.apiRateLimitPerMinute,
        rateLimitPerDay: planLimits.apiRateLimitPerDay,
        enabled: true,
        createdAt: now,
        updatedAt: now,
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
      const { name, enabled } = parsed.data;
      if (name !== undefined) fields.name = name;
      if (enabled !== undefined) fields.enabled = enabled;

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
