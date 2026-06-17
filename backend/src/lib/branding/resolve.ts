import type { ResolvedTenantBranding, Tenant } from "../../types/index.js";

export const DEFAULT_PRIMARY_COLOR = "#4f46e5";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isValidPrimaryColor(color: string): boolean {
  return HEX_COLOR.test(color);
}

export function normalizePrimaryColor(color: string | undefined): string {
  if (!color) return DEFAULT_PRIMARY_COLOR;
  const trimmed = color.trim();
  if (!HEX_COLOR.test(trimmed)) return DEFAULT_PRIMARY_COLOR;
  return trimmed.toLowerCase();
}

export function buildLogoS3Key(tenantId: string, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `branding/${tenantId}/logo.${safeExt}`;
}

export function extensionForContentType(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "image/png":
    default:
      return "png";
  }
}

export function resolveBranding(
  tenant: Tenant,
  logoUrl?: string
): ResolvedTenantBranding {
  const brandName = tenant.branding?.brandName?.trim() || tenant.name;
  const primaryColor = normalizePrimaryColor(tenant.branding?.primaryColor);
  return {
    brandName,
    primaryColor,
    ...(logoUrl ? { logoUrl } : {}),
  };
}
