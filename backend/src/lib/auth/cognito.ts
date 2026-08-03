import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthContext, Tenant } from "../../types/index.js";
import { getTenant } from "../dynamodb/tenant.repository.js";

function readJwtClaims(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Record<string, unknown> {
  const authorizer = event.requestContext.authorizer as
    | { jwt?: { claims?: Record<string, unknown> } }
    | undefined;
  const claims = authorizer?.jwt?.claims;
  if (!claims || typeof claims !== "object") {
    const error = new Error("Missing JWT claims in request context");
    (error as Error & { statusCode: number }).statusCode = 401;
    throw error;
  }
  return claims;
}

function readHeader(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  name: string
): string {
  const headers = event.headers ?? {};
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && value) return String(value).trim();
  }
  return "";
}

export function extractAuthContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): AuthContext {
  const claims = readJwtClaims(event);

  const tenantId = String(claims["custom:tenantId"] ?? "").trim();
  const userId = String(claims["sub"] ?? "").trim();
  const email = String(claims["email"] ?? "").trim();
  const name = String(claims["name"] ?? "").trim() || undefined;
  const role = String((claims["custom:role"] as string) ?? "member").trim() || "member";

  if (!userId) {
    const error = new Error("Missing required claims in JWT token");
    (error as Error & { statusCode: number }).statusCode = 401;
    throw error;
  }

  if (!tenantId && role !== "admin") {
    const error = new Error("Missing required claims in JWT token");
    (error as Error & { statusCode: number }).statusCode = 401;
    throw error;
  }

  return {
    tenantId,
    userId,
    email,
    ...(name !== undefined ? { name } : {}),
    role: role as AuthContext["role"],
  };
}

export async function applyTenantContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<AuthContext> {
  const contextTenantId = readHeader(event, "x-tenant-context");
  if (!contextTenantId || contextTenantId === auth.tenantId) {
    return auth;
  }

  if (auth.role !== "member") {
    const error = new Error("Only reseller members can assume a subaccount");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }

  const child = await getTenant(contextTenantId);
  if (!child || child.parentTenantId !== auth.tenantId) {
    const error = new Error("Access denied: invalid tenant context");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }

  if (child.status === "suspended") {
    const error = new Error("Subaccount is suspended");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }

  return {
    ...auth,
    tenantId: contextTenantId,
    homeTenantId: auth.tenantId,
  };
}

export async function resolveRequestAuth(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<AuthContext> {
  const auth = extractAuthContext(event);
  return applyTenantContext(event, auth);
}

export function assertTenantAccess(
  authContext: AuthContext,
  resourceTenantId: string
): void {
  if (authContext.role !== "admin" && authContext.tenantId !== resourceTenantId) {
    const error = new Error("Access denied: tenant mismatch");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

export function assertMemberRole(authContext: AuthContext): void {
  if (authContext.role === "admin") {
    const error = new Error("Platform admin cannot access tenant product APIs");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
  if (authContext.role === "advisor") {
    const error = new Error("Advisor cannot access this resource");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

export function assertTenantManagerRole(authContext: AuthContext): void {
  assertMemberRole(authContext);
}

export function assertAdvisorOrMember(authContext: AuthContext): void {
  if (authContext.role === "admin") {
    const error = new Error("Platform admin cannot access tenant product APIs");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
  if (authContext.role !== "member" && authContext.role !== "advisor") {
    const error = new Error("Access denied");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

export function assertAdminRole(authContext: AuthContext): void {
  if (authContext.role !== "admin") {
    const error = new Error("Admin access required");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

export function isResellerTenant(tenant: Tenant | null | undefined): boolean {
  return Boolean(
    tenant &&
      (tenant.plan === "reseller" || tenant.tenantKind === "reseller")
  );
}

export async function assertResellerTenant(authContext: AuthContext): Promise<Tenant> {
  assertMemberRole(authContext);
  const homeTenantId = authContext.homeTenantId ?? authContext.tenantId;
  const tenant = await getTenant(homeTenantId);
  if (!isResellerTenant(tenant)) {
    const error = new Error("Reseller plan required");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
  return tenant!;
}

export async function assertResellerOwnsSubaccount(
  parentTenantId: string,
  childTenantId: string
): Promise<Tenant> {
  const child = await getTenant(childTenantId);
  if (!child || child.parentTenantId !== parentTenantId) {
    const error = new Error("Subaccount not found");
    (error as Error & { statusCode: number }).statusCode = 404;
    throw error;
  }
  return child;
}
