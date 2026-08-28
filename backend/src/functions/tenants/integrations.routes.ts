import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import type { AuthContext } from "../../types/index.js";
import { assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  deleteMicrosoftSsoConfiguration,
  getIntegrationCatalog,
  getMicrosoftSsoView,
  saveMicrosoftSsoConfiguration,
  testMicrosoftSsoConfiguration,
  updateMicrosoftSsoEnabled,
} from "../../lib/integrations/microsoft-sso.service.js";
import {
  disconnectGoogleBusiness,
  getGoogleBusinessView,
  handleGoogleBusinessOAuthCallback,
  refreshGoogleBusinessLocations,
  startGoogleBusinessOAuth,
  updateGoogleBusinessSettings,
} from "../../lib/google-business/service.js";
import { badRequest, handleError, ok, parseJsonBody, redirect } from "../../lib/http.js";

const SaveMicrosoftSsoSchema = z.object({
  protocol: z.enum(["oidc", "saml"]),
  enabled: z.boolean().optional(),
  entraTenantId: z.string().min(3).max(128).optional(),
  clientId: z.string().min(3).max(128).optional(),
  clientSecret: z.string().min(1).max(512).optional(),
  metadataUrl: z.string().url().max(2048).optional(),
  allowedDomains: z.array(z.string().min(1).max(253)).max(20).optional(),
  enforceSso: z.boolean().optional(),
});

const EnableSchema = z.object({
  enabled: z.boolean(),
});

const GoogleBusinessPatchSchema = z.object({
  enabled: z.boolean().optional(),
  selectedLocationIds: z.array(z.string().min(1).max(256)).max(100).optional(),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

export async function handleIntegrationRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext,
  environment: string
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/integrations")) return null;

  if (rawPath.includes("/tenants/me/integrations")) {
    assertMemberRole(auth);
    await ensureTenant(auth.tenantId, auth.email, auth.name);

    if (method === "GET" && rawPath.endsWith("/integrations")) {
      const catalog = await getIntegrationCatalog(auth.tenantId);
      return ok(catalog);
    }

    if (rawPath.includes("/integrations/microsoft-sso")) {
      if (method === "GET" && rawPath.endsWith("/microsoft-sso")) {
        const view = await getMicrosoftSsoView(auth.tenantId);
        return ok(view);
      }

      if (method === "PUT" && rawPath.endsWith("/microsoft-sso")) {
        const body = parseJsonBody(event);
        const parsed = SaveMicrosoftSsoSchema.safeParse(body);
        if (!parsed.success) return badRequest(formatZodError(parsed.error));
        try {
          const view = await saveMicrosoftSsoConfiguration({
            tenantId: auth.tenantId,
            environment,
            protocol: parsed.data.protocol,
            ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
            ...(parsed.data.entraTenantId ? { entraTenantId: parsed.data.entraTenantId } : {}),
            ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}),
            ...(parsed.data.clientSecret ? { clientSecret: parsed.data.clientSecret } : {}),
            ...(parsed.data.metadataUrl ? { metadataUrl: parsed.data.metadataUrl } : {}),
            ...(parsed.data.allowedDomains ? { allowedDomains: parsed.data.allowedDomains } : {}),
            ...(parsed.data.enforceSso !== undefined ? { enforceSso: parsed.data.enforceSso } : {}),
          });
          return ok(view);
        } catch (error) {
          return handleError(error);
        }
      }

      if (method === "PATCH" && rawPath.endsWith("/microsoft-sso")) {
        const body = parseJsonBody(event);
        const parsed = EnableSchema.safeParse(body);
        if (!parsed.success) return badRequest(formatZodError(parsed.error));
        try {
          const view = await updateMicrosoftSsoEnabled(
            auth.tenantId,
            parsed.data.enabled,
            environment
          );
          return ok(view);
        } catch (error) {
          return handleError(error);
        }
      }

      if (method === "POST" && rawPath.endsWith("/microsoft-sso/test")) {
        try {
          const view = await testMicrosoftSsoConfiguration(auth.tenantId, environment);
          return ok(view);
        } catch (error) {
          return handleError(error);
        }
      }

      if (method === "DELETE" && rawPath.endsWith("/microsoft-sso")) {
        const view = await deleteMicrosoftSsoConfiguration(auth.tenantId, environment);
        return ok(view);
      }
    }

    if (rawPath.includes("/integrations/google-business-profile")) {
      if (method === "GET" && rawPath.endsWith("/oauth/start")) {
        try {
          const result = await startGoogleBusinessOAuth(auth.tenantId);
          return ok(result);
        } catch (error) {
          return handleError(error);
        }
      }

      if (method === "GET" && rawPath.endsWith("/google-business-profile")) {
        const view = await getGoogleBusinessView(auth.tenantId);
        return ok(view);
      }

      if (method === "POST" && rawPath.endsWith("/locations/refresh")) {
        try {
          const view = await refreshGoogleBusinessLocations(auth.tenantId, environment);
          return ok(view);
        } catch (error) {
          return handleError(error);
        }
      }

      if (method === "PATCH" && rawPath.endsWith("/google-business-profile")) {
        const body = parseJsonBody(event);
        const parsed = GoogleBusinessPatchSchema.safeParse(body);
        if (!parsed.success) return badRequest(formatZodError(parsed.error));
        try {
          const view = await updateGoogleBusinessSettings(auth.tenantId, {
            ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
            ...(parsed.data.selectedLocationIds
              ? { selectedLocationIds: parsed.data.selectedLocationIds }
              : {}),
          });
          return ok(view);
        } catch (error) {
          return handleError(error);
        }
      }

      if (method === "DELETE" && rawPath.endsWith("/google-business-profile")) {
        try {
          const view = await disconnectGoogleBusiness(auth.tenantId, environment);
          return ok(view);
        } catch (error) {
          return handleError(error);
        }
      }
    }
  }

  return null;
}

export async function handleGoogleBusinessOAuthCallbackRoute(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  environment: string
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  const method = event.requestContext.http.method;
  if (method !== "GET" || !rawPath.includes("/public/integrations/google-business/oauth/callback")) {
    return null;
  }

  const code = event.queryStringParameters?.code?.trim() ?? "";
  const state = event.queryStringParameters?.state?.trim() ?? "";
  const oauthError = event.queryStringParameters?.error?.trim() ?? "";

  if (oauthError) {
    const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return redirect(
      `${frontendUrl}/integrations/google-business?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state) {
    return badRequest("code and state are required");
  }

  const redirectUrl = await handleGoogleBusinessOAuthCallback(code, state, environment);
  return redirect(redirectUrl);
}
