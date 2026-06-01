import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthContext } from "../../types/index.js";

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
    role: role as "admin" | "member",
  };
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
}

export function assertAdminRole(authContext: AuthContext): void {
  if (authContext.role !== "admin") {
    const error = new Error("Admin access required");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}
