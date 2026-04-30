import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthContext } from "../../types/index.js";

export function extractAuthContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): AuthContext {
  const claims = event.requestContext.authorizer.jwt.claims;

  const tenantId = claims["custom:tenantId"] as string;
  const userId = claims["sub"] as string;
  const email = claims["email"] as string;
  const role = (claims["custom:role"] as string) ?? "member";

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
