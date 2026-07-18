import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthContext } from "../../types/index.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const issuer = process.env.COGNITO_ISSUER_URL ?? "";
  if (!issuer) {
    throw new Error("COGNITO_ISSUER_URL is not configured");
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifyCognitoToken(token: string): Promise<AuthContext> {
  const issuer = process.env.COGNITO_ISSUER_URL ?? "";
  const clientId = process.env.COGNITO_CLIENT_ID ?? "";
  if (!issuer || !clientId) {
    throw new Error("Cognito JWT configuration is missing");
  }

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer,
    audience: clientId,
  });

  const tenantId = String(payload["custom:tenantId"] ?? "").trim();
  const userId = String(payload.sub ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const name = String(payload.name ?? "").trim() || undefined;
  const role = String((payload["custom:role"] as string) ?? "member").trim() || "member";

  if (!userId) {
    throw new Error("Missing required claims in JWT token");
  }

  if (!tenantId && role !== "admin") {
    throw new Error("Missing required claims in JWT token");
  }

  return {
    tenantId,
    userId,
    email,
    ...(name !== undefined ? { name } : {}),
    role: role as AuthContext["role"],
  };
}
