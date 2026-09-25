import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import type { AuthContext } from "../../types/index.js";
import { assertResellerTenant } from "../../lib/auth/cognito.js";
import { resolveApiBaseUrl } from "../../lib/api-base-url.js";
import {
  deleteTenantMetaAppCredential,
  getMetaAppConfigStatus,
  getTenantMetaAppCredential,
  saveTenantMetaAppCredential,
} from "../../lib/integrations/meta-app-credentials.js";
import { normalizeMetaAppPayload } from "../../lib/integrations/meta-app-credentials.validation.js";
import { assertSettingsAccess } from "../../lib/auth/permissions.js";
import { writeAuditEvent } from "../../lib/audit/write-audit-event.js";
import { badRequest, forbidden, handleError, ok, parseJsonBody } from "../../lib/http.js";

export async function handleMetaAppRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext,
  environment: string
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? "";
  if (!rawPath.includes("/meta-app")) return null;

  await assertSettingsAccess(auth, method);
  const apiBaseUrl = resolveApiBaseUrl(event);

  if (method === "GET") {
    const status = await getMetaAppConfigStatus(auth.tenantId, environment, apiBaseUrl);
    return ok(status);
  }

  if (method === "PUT") {
    const homeTenantId = auth.homeTenantId ?? auth.tenantId;
    if (homeTenantId !== auth.tenantId) {
      return forbidden("Configure Meta App from your reseller account, not while assuming a subaccount");
    }

    try {
      await assertResellerTenant(auth);
    } catch (error) {
      return handleError(error);
    }

    const body = parseJsonBody(event) as {
      appId?: string;
      appSecret?: string;
      embeddedSignupConfigId?: string;
    };

    try {
      const existing = await getTenantMetaAppCredential(auth.tenantId, environment);
      const payload = normalizeMetaAppPayload(body, existing);
      await saveTenantMetaAppCredential(auth.tenantId, environment, payload);
    } catch (error) {
      return handleError(error);
    }

    await writeAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      module: "settings",
      action: "update",
      entityType: "metaApp",
      entityId: auth.tenantId,
      summary: "Updated Meta app configuration",
    });
    const status = await getMetaAppConfigStatus(auth.tenantId, environment, apiBaseUrl);
    return ok(status);
  }

  if (method === "DELETE") {
    const homeTenantId = auth.homeTenantId ?? auth.tenantId;
    if (homeTenantId !== auth.tenantId) {
      return forbidden("Configure Meta App from your reseller account, not while assuming a subaccount");
    }

    try {
      await assertResellerTenant(auth);
    } catch (error) {
      return handleError(error);
    }

    await deleteTenantMetaAppCredential(auth.tenantId, environment);
    await writeAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      module: "settings",
      action: "delete",
      entityType: "metaApp",
      entityId: auth.tenantId,
      summary: "Removed Meta app configuration",
    });
    const status = await getMetaAppConfigStatus(auth.tenantId, environment, apiBaseUrl);
    return ok(status);
  }

  return badRequest("Route not found");
}
