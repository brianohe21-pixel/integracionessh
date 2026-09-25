import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { AuthContext } from "../../types/index.js";
import { assertTenantAdminRole } from "../../lib/auth/cognito.js";
import {
  PERMISSIONS,
  assertPermission,
  permissionsForRole,
  resolveEffectivePermissions,
  sanitizePermissions,
} from "../../lib/auth/permissions.js";
import {
  countMembersWithCustomRole,
  deleteCustomRole,
  getCustomRole,
  listCustomRoles,
  putCustomRole,
} from "../../lib/dynamodb/role.repository.js";
import { listAuditEvents, type AuditModule } from "../../lib/audit/write-audit-event.js";
import { badRequest, created, forbidden, noContent, notFound, ok, parseJsonBody } from "../../lib/http.js";

const AUDIT_MODULES = ["bots", "campaigns", "contacts", "payments", "settings"] as const;

const RoleBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  permissions: z.array(z.string()).max(PERMISSIONS.length),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

function roleIdFromPath(rawPath: string): string | null {
  const match = rawPath.match(/\/tenants\/me\/roles\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handleAccessRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  const proxy = event.pathParameters?.proxy ?? "";
  const path = proxy && !rawPath.includes("/tenants/me/")
    ? `/tenants/me/${proxy}`
    : rawPath;

  if (method === "GET" && path.endsWith("/tenants/me/permissions")) {
    if (auth.role === "admin") return forbidden("Platform admin cannot access tenant product APIs");
    const permissions = await resolveEffectivePermissions(auth);
    return ok({
      permissions,
      presets: {
        member: permissionsForRole("member"),
        supervisor: permissionsForRole("supervisor"),
        advisor: permissionsForRole("advisor"),
      },
      catalog: [...PERMISSIONS],
    });
  }

  if (path.includes("/tenants/me/roles")) {
    if (method === "GET" && path.endsWith("/tenants/me/roles")) {
      if (auth.role !== "member" && auth.role !== "supervisor") {
        return forbidden("Access denied");
      }
      const roles = await listCustomRoles(auth.tenantId);
      return ok({ roles });
    }

    try {
      assertTenantAdminRole(auth);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 403) return forbidden((error as Error).message);
      throw error;
    }

    if (method === "POST" && path.endsWith("/tenants/me/roles")) {
      const parsed = RoleBodySchema.safeParse(parseJsonBody(event));
      if (!parsed.success) return badRequest(formatZodError(parsed.error));
      const now = new Date().toISOString();
      const role = await putCustomRole({
        roleId: randomUUID(),
        tenantId: auth.tenantId,
        name: parsed.data.name,
        permissions: sanitizePermissions(parsed.data.permissions),
        createdAt: now,
        updatedAt: now,
      });
      return created(role);
    }

    const roleId = roleIdFromPath(path);
    if (!roleId) return badRequest("Role id is required");

    if (method === "PATCH") {
      const existing = await getCustomRole(auth.tenantId, roleId);
      if (!existing) return notFound("Role not found");
      const parsed = RoleBodySchema.partial().safeParse(parseJsonBody(event));
      if (!parsed.success) return badRequest(formatZodError(parsed.error));
      const updated = await putCustomRole({
        ...existing,
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.permissions !== undefined
          ? { permissions: sanitizePermissions(parsed.data.permissions) }
          : {}),
        updatedAt: new Date().toISOString(),
      });
      return ok(updated);
    }

    if (method === "DELETE") {
      const existing = await getCustomRole(auth.tenantId, roleId);
      if (!existing) return notFound("Role not found");
      const assigned = await countMembersWithCustomRole(auth.tenantId, roleId);
      if (assigned > 0) {
        return badRequest("Cannot delete a role that is assigned to members");
      }
      await deleteCustomRole(auth.tenantId, roleId);
      return noContent();
    }
  }

  if (method === "GET" && path.endsWith("/tenants/me/audit")) {
    await assertPermission(auth, "audit.read");
    const moduleParam = event.queryStringParameters?.module;
    const module = AUDIT_MODULES.find((item) => item === moduleParam) as AuditModule | undefined;
    if (moduleParam && !module) return badRequest("Invalid module");
    const limit = Math.min(100, Math.max(1, Number(event.queryStringParameters?.limit ?? 50) || 50));
    const page = await listAuditEvents({
      tenantId: auth.tenantId,
      ...(module ? { module } : {}),
      limit,
      ...(event.queryStringParameters?.cursor
        ? { cursor: event.queryStringParameters.cursor }
        : {}),
    });
    return ok(page);
  }

  return null;
}
