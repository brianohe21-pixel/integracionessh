import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthContext } from "../../types/index.js";

export function extractAuthContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): AuthContext {
  const claims = event.requestContext.authorizer.jwt.claims;

  const tenantId = String(claims["custom:tenantId"] ?? "").trim();
  const userId = String(claims["sub"] ?? "").trim();
  const email = String(claims["email"] ?? "").trim();
  const name = String(claims["name"] ?? "").trim() || undefined;
  const role = String((claims["custom:role"] as string) ?? "member").trim() || "member";

  if (!tenantId || !userId) {
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
