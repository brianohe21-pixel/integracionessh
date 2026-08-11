import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import type { AuthContext } from "../../types/index.js";
import {
  deleteTenantProviderCredential,
  getProviderCredentialStatuses,
  saveTenantProviderCredential,
  type ProviderId,
} from "../../lib/integrations/provider-credentials.js";
import {
  normalizeElevenLabsPayload,
  normalizeOpenAIPayload,
  normalizeTelnyxPayload,
  validateProviderCredential,
} from "../../lib/integrations/provider-credentials.validation.js";
import { badRequest, handleError, ok, parseJsonBody } from "../../lib/http.js";

const ProviderSchema = z.enum(["openai", "telnyx", "elevenlabs"]);

export async function handleProviderCredentialRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext,
  environment: string
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? "";
  if (!rawPath.includes("/provider-credentials")) return null;

  const providerParam = event.pathParameters?.provider;
  const apiBaseUrl =
    process.env.API_BASE_URL ?? process.env.API_PUBLIC_URL ?? process.env.PUBLIC_API_URL ?? "";

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
        const payload = normalizeTelnyxPayload(
          body as { apiKey?: string; connectionId?: string; publicKey?: string }
        );
        await validateProviderCredential(provider, payload);
        await saveTenantProviderCredential(auth.tenantId, environment, provider, payload);
      } else {
        const payload = normalizeElevenLabsPayload(body as { apiKey?: string });
        await validateProviderCredential(provider, payload);
        await saveTenantProviderCredential(auth.tenantId, environment, provider, payload);
      }
    } catch (error) {
      return handleError(error);
    }

    const items = await getProviderCredentialStatuses(auth.tenantId, environment, apiBaseUrl);
    const item = items.find((entry) => entry.provider === provider);
    return ok(item ?? { provider, configured: true, source: "own", ownerTenantId: auth.tenantId });
  }

  if (method === "DELETE") {
    await deleteTenantProviderCredential(auth.tenantId, environment, provider);
    const items = await getProviderCredentialStatuses(auth.tenantId, environment, apiBaseUrl);
    const item = items.find((entry) => entry.provider === provider);
    return ok(item ?? { provider, configured: false, source: "none" });
  }

  return null;
}
