import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthContext } from "../../types/index.js";

export function extractAuthContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): AuthContext {
  const claims = event.requestContext.authorizer.jwt.claims;

  const tenantId = String(claims["custom:tenantId"] ?? "").trim();
  const userId = String(claims["sub"] ?? "").trim();
  const email = String(claims["email"] ?? "").trim();
  const role = String((claims["custom:role"] as string) ?? "member").trim() || "member";

  if (!tenantId || !userId) {
    throw new Error("Missing required claims in JWT token");
  }

  return {
    tenantId,
    userId,
    email,
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
