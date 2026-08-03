import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const PORTAL_TENANT_COOKIE = "wl-portal-tenant-id";

type PortalBranding = {
  found?: boolean;
  tenantId?: string;
  brandName?: string;
  primaryColor?: string;
  logoUrl?: string;
};

async function fetchPortalBranding(host: string): Promise<PortalBranding | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(
      `${API_URL}/public/branding-by-host?host=${encodeURIComponent(host)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return (await res.json()) as PortalBranding;
  } catch {
    return null;
  }
}

function applyPortalCookies(response: NextResponse, portal: PortalBranding): void {
  if (portal.brandName) {
    response.cookies.set("wl-brand-name", portal.brandName, { path: "/" });
  }
  if (portal.primaryColor) {
    response.cookies.set("wl-primary-color", portal.primaryColor, { path: "/" });
  }
  if (portal.logoUrl) {
    response.cookies.set("wl-logo-url", portal.logoUrl, { path: "/" });
  }
  if (portal.tenantId) {
    response.cookies.set(PORTAL_TENANT_COOKIE, portal.tenantId, { path: "/" });
  }
}

function clearPortalCookies(response: NextResponse): void {
  response.cookies.delete(PORTAL_TENANT_COOKIE);
  response.cookies.delete("wl-brand-name");
  response.cookies.delete("wl-primary-color");
  response.cookies.delete("wl-logo-url");
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const pathname = request.nextUrl.pathname;

  if (!host || !API_URL) return NextResponse.next();

  const portal = await fetchPortalBranding(host);
  const isRestrictedPortal = Boolean(portal?.found && portal.tenantId);

  if (isRestrictedPortal && pathname.startsWith("/register")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    applyPortalCookies(response, portal!);
    return response;
  }

  const response = NextResponse.next();

  if (isRestrictedPortal && portal) {
    applyPortalCookies(response, portal);
  } else {
    clearPortalCookies(response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
