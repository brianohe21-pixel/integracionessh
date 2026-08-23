import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import type { AuthContext } from "../../types/index.js";
import { assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  getTenantEmailSettingsView,
  registerTenantEmailDomain,
  removeTenantEmailDomain,
  updateTenantEmailSettings,
  verifyTenantEmailDomain,
} from "../../lib/email/tenant-email.service.js";
import { badRequest, handleError, ok, parseJsonBody } from "../../lib/http.js";

const UpdateEmailSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(128).optional(),
});

const RegisterDomainSchema = z.object({
  domain: z.string().min(3).max(253),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

export async function handleEmailSettingsRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/tenants/me/email-settings")) return null;

  assertMemberRole(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET" && rawPath.endsWith("/email-settings")) {
    const view = await getTenantEmailSettingsView(auth.tenantId);
    return ok(view);
  }

  if (method === "PUT" && rawPath.endsWith("/email-settings")) {
    const body = parseJsonBody(event);
    const parsed = UpdateEmailSettingsSchema.safeParse(body);
    if (!parsed.success) return badRequest(formatZodError(parsed.error));
    const view = await updateTenantEmailSettings(auth.tenantId, parsed.data);
    return ok(view);
  }

  if (method === "PUT" && rawPath.endsWith("/email-settings/domain")) {
    const body = parseJsonBody(event);
    const parsed = RegisterDomainSchema.safeParse(body);
    if (!parsed.success) return badRequest(formatZodError(parsed.error));
    try {
      const view = await registerTenantEmailDomain(auth.tenantId, parsed.data.domain);
      return ok(view);
    } catch (error) {
      return handleError(error);
    }
  }

  if (method === "POST" && rawPath.endsWith("/email-settings/domain/verify")) {
    try {
      const view = await verifyTenantEmailDomain(auth.tenantId);
      return ok(view);
    } catch (error) {
      return handleError(error);
    }
  }

  if (method === "DELETE" && rawPath.endsWith("/email-settings/domain")) {
    const view = await removeTenantEmailDomain(auth.tenantId);
    return ok(view);
  }

  return badRequest("Route not found");
}
