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
import { badRequest, handleError, ok, parseJsonBody } from "../../lib/http.js";

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
  }

  return null;
}
