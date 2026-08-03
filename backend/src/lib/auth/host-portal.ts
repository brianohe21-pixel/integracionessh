import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthContext } from "../../types/index.js";
import { getTenant, getTenantIdByDomain, normalizeDomain } from "../dynamodb/tenant.repository.js";

export function readPortalHost(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): string {
  const headers = event.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "x-portal-host" && value) {
      return normalizeDomain(String(value));
    }
  }
  const fromQuery = event.queryStringParameters?.host;
  if (fromQuery) return normalizeDomain(fromQuery);
  const host = headers.host ?? headers.Host;
  if (host) return normalizeDomain(String(host).split(":")[0] ?? "");
  return "";
}

export async function getActivePortalTenantId(host: string): Promise<string | null> {
  const normalized = normalizeDomain(host);
  if (!normalized) return null;

  const tenantId = await getTenantIdByDomain(normalized);
  if (!tenantId) return null;

  const tenant = await getTenant(tenantId);
  if (!tenant || tenant.status === "suspended") return null;
  if (tenant.resellerConfig?.customDomainStatus !== "active") return null;

  return tenantId;
}

export async function isTenantAllowedOnPortal(
  userTenantId: string,
  portalTenantId: string
): Promise<boolean> {
  if (!userTenantId || !portalTenantId) return false;
  if (userTenantId === portalTenantId) return true;

  const userTenant = await getTenant(userTenantId);
  if (!userTenant) return false;
  return userTenant.parentTenantId === portalTenantId;
}

export async function isAuthAllowedOnPortal(
  auth: AuthContext,
  portalTenantId: string
): Promise<boolean> {
  if (auth.role === "admin") return false;

  const homeTenantId = auth.homeTenantId ?? auth.tenantId;
  if (!(await isTenantAllowedOnPortal(homeTenantId, portalTenantId))) {
    return false;
  }

  if (auth.tenantId !== homeTenantId) {
    return isTenantAllowedOnPortal(auth.tenantId, portalTenantId);
  }

  return true;
}

export async function assertPortalHostAccess(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<void> {
  const host = readPortalHost(event);
  if (!host) return;

  const portalTenantId = await getActivePortalTenantId(host);
  if (!portalTenantId) return;

  const allowed = await isAuthAllowedOnPortal(auth, portalTenantId);
  if (!allowed) {
    const error = new Error("This account cannot access this portal");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}
