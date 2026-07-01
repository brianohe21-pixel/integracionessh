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
import { DEFAULT_API_KEY_SCOPES } from "../../lib/api-keys/scopes.js";
import type { ApiKey } from "../../types/index.js";

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(128),
  botId: z.string().uuid(),
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseUsageDateRange(
  params: Record<string, string | undefined> | undefined
): { fromIso: string; toIso: string } {
  const now = new Date();
  const defaultFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const defaultTo = now.toISOString();

  const from = params?.from;
  const to = params?.to;
  if (!from || !to || !DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
    return { fromIso: defaultFrom, toIso: defaultTo };
  }

  const [fromIso, toIso] =
    from <= to
      ? [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`]
      : [`${to}T00:00:00.000Z`, `${from}T23:59:59.999Z`];

  return { fromIso, toIso };
}

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
      const { fromIso, toIso } = parseUsageDateRange(event.queryStringParameters);

      const usageResults = await Promise.all(
        keys.map(async (key) => {
          const monthSummary = await summarizeApiKeyUsageByPeriod(
            auth.tenantId,
            key.keyId,
            fromIso,
            toIso
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

      const limit = Math.min(parseInt(event.queryStringParameters?.limit ?? "50", 10) || 50, 100);
      const errorsOnly = event.queryStringParameters?.errorsOnly === "true";
      const { fromIso, toIso } = parseUsageDateRange(event.queryStringParameters);
      const logs = await listApiKeyUsageLogs(auth.tenantId, keyId, limit, fromIso, toIso);
      const filtered = errorsOnly ? logs.filter((log) => log.statusCode >= 400) : logs;
      return ok(filtered);
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
        scopes: [...DEFAULT_API_KEY_SCOPES],
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
