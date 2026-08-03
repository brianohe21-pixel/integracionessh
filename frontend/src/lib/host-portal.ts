import { fetchAuthSession } from "aws-amplify/auth";
import { api } from "@/lib/api";

export type PortalBranding = {
  found: boolean;
  tenantId?: string;
  brandName?: string;
  primaryColor?: string;
  logoUrl?: string;
};

const PORTAL_TENANT_COOKIE = "wl-portal-tenant-id";

export function getBrowserPortalHost(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.trim().toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function readPortalTenantCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PORTAL_TENANT_COOKIE}=([^;]*)`)
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  return value.trim() || null;
}

export async function fetchPortalBranding(host: string): Promise<PortalBranding> {
  return api.getPublic<PortalBranding>(
    `/public/branding-by-host?host=${encodeURIComponent(host)}`
  );
}

export async function getRestrictedPortalTenantId(): Promise<string | null> {
  const fromCookie = readPortalTenantCookie();
  if (fromCookie) return fromCookie;

  const host = getBrowserPortalHost();
  if (!host) return null;

  try {
    const portal = await fetchPortalBranding(host);
    if (portal.found && portal.tenantId) return portal.tenantId;
  } catch {
    return null;
  }
  return null;
}

export async function isRestrictedPortalHost(host: string): Promise<boolean> {
  try {
    const portal = await fetchPortalBranding(host);
    return portal.found === true && Boolean(portal.tenantId);
  } catch {
    return Boolean(readPortalTenantCookie());
  }
}

export async function validatePortalSession(): Promise<
  { ok: true } | { ok: false; messageKey: "auth.portalAccessDenied" }
> {
  const portalTenantId = await getRestrictedPortalTenantId();
  if (!portalTenantId) return { ok: true };

  const host = getBrowserPortalHost();
  if (!host) return { ok: true };

  let session;
  try {
    session = await fetchAuthSession();
  } catch {
    return { ok: false, messageKey: "auth.portalAccessDenied" };
  }

  const token = session.tokens?.idToken;
  if (!token) {
    return { ok: false, messageKey: "auth.portalAccessDenied" };
  }

  const userTenantId = String(token.payload["custom:tenantId"] ?? "").trim();
  if (!userTenantId) {
    return { ok: false, messageKey: "auth.portalAccessDenied" };
  }

  if (userTenantId === portalTenantId) {
    return { ok: true };
  }

  try {
    await api.get<{ allowed: boolean }>(
      `/auth/portal-access?host=${encodeURIComponent(host)}`
    );
    return { ok: true };
  } catch {
    return { ok: false, messageKey: "auth.portalAccessDenied" };
  }
}

export async function enforcePortalSessionOrSignOut(
  signOut: () => Promise<void>
): Promise<boolean> {
  const result = await validatePortalSession();
  if (result.ok) return true;
  await signOut();
  return false;
}
