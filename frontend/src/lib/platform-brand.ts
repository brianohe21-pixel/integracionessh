export const PLATFORM_LOGO_PATH = "/brand/integracionessh-icon.png";

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

export function readPortalBrandingFromCookies(): {
  brandName?: string;
  logoUrl?: string;
} {
  return {
    brandName: readCookie("wl-brand-name"),
    logoUrl: readCookie("wl-logo-url"),
  };
}
