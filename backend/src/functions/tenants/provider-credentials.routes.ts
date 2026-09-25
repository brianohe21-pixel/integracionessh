import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import type { AuthContext } from "../../types/index.js";
import {
  deleteTenantProviderCredential,
  getProviderCredentialStatuses,
  getTenantProviderCredential,
  saveTenantProviderCredential,
  type ProviderId,
} from "../../lib/integrations/provider-credentials.js";
import {
  normalizeDeepgramPayload,
  normalizeElevenLabsPayload,
  normalizeOpenAIPayload,
  normalizeTelnyxPayload,
  assertTelnyxApiKeyValid,
  validateProviderCredential,
} from "../../lib/integrations/provider-credentials.validation.js";
import { resolveApiBaseUrl } from "../../lib/api-base-url.js";
import { prepareTelnyxCredentialPayload } from "../../lib/telnyx/provision.js";
import { assertSettingsAccess } from "../../lib/auth/permissions.js";
import { writeAuditEvent } from "../../lib/audit/write-audit-event.js";
import { badRequest, handleError, ok, parseJsonBody } from "../../lib/http.js";

const ProviderSchema = z.enum(["openai", "telnyx", "elevenlabs", "deepgram"]);

export async function handleProviderCredentialRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext,
  environment: string
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? "";
  if (!rawPath.includes("/provider-credentials")) return null;

  await assertSettingsAccess(auth, method);
  const providerParam = event.pathParameters?.provider;
  const apiBaseUrl = resolveApiBaseUrl(event);

  if (method === "GET" && rawPath.endsWith("/provider-credentials")) {
    const items = await getProviderCredentialStatuses(auth.tenantId, environment, apiBaseUrl);
    return ok({ items });
  }

  if (!providerParam) return badRequest("Provider is required");

  const parsedProvider = ProviderSchema.safeParse(providerParam);
  if (!parsedProvider.success) return badRequest("Invalid provider");

  const provider = parsedProvider.data as ProviderId;

  if (method === "PUT") {
    const body = parseJsonBody(event);
    try {
      if (provider === "openai") {
        const payload = normalizeOpenAIPayload(body as { apiKey?: string });
        await validateProviderCredential(provider, payload);
        await saveTenantProviderCredential(auth.tenantId, environment, provider, payload);
      } else if (provider === "telnyx") {
        const normalized = normalizeTelnyxPayload(
          body as { apiKey?: string; connectionId?: string; publicKey?: string }
        );
        await assertTelnyxApiKeyValid(normalized.apiKey);
        const existing = await getTenantProviderCredential(auth.tenantId, environment, "telnyx");
        const payload = await prepareTelnyxCredentialPayload({
          apiKey: normalized.apiKey,
          tenantId: auth.tenantId,
          apiBaseUrl,
          ...(normalized.connectionId ? { connectionId: normalized.connectionId } : {}),
          ...(normalized.publicKey ? { publicKey: normalized.publicKey } : {}),
          existing,
        });
        await saveTenantProviderCredential(auth.tenantId, environment, provider, payload);
      } else if (provider === "elevenlabs") {
        const payload = normalizeElevenLabsPayload(body as { apiKey?: string });
        await validateProviderCredential(provider, payload);
        await saveTenantProviderCredential(auth.tenantId, environment, provider, payload);
      } else {
        const payload = normalizeDeepgramPayload(body as { apiKey?: string });
        await validateProviderCredential(provider, payload);
        await saveTenantProviderCredential(auth.tenantId, environment, provider, payload);
      }
    } catch (error) {
      return handleError(error);
    }

    const items = await getProviderCredentialStatuses(auth.tenantId, environment, apiBaseUrl);
    const item = items.find((entry) => entry.provider === provider);
    await writeAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      module: "settings",
      action: "update",
      entityType: "providerCredential",
      entityId: provider,
      summary: `Updated ${provider} credentials`,
    });
    return ok(item ?? { provider, configured: true, source: "own", ownerTenantId: auth.tenantId });
  }

  if (method === "DELETE") {
    await deleteTenantProviderCredential(auth.tenantId, environment, provider);
    await writeAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      module: "settings",
      action: "delete",
      entityType: "providerCredential",
      entityId: provider,
      summary: `Removed ${provider} credentials`,
    });
    const items = await getProviderCredentialStatuses(auth.tenantId, environment, apiBaseUrl);
    const item = items.find((entry) => entry.provider === provider);
    return ok(item ?? { provider, configured: false, source: "none" });
  }

  return null;
}
