import type { ResolvedTenantBranding, Tenant } from "../../types/index.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { getResolvedTenantBranding } from "./service.js";
import { resolveBranding } from "./resolve.js";
import { getPresignedReadUrl } from "../s3/client.js";

export async function getResolvedBrandingWithInheritance(
  tenant: Tenant
): Promise<ResolvedTenantBranding> {
  const hasOwnBranding = Boolean(
    tenant.branding?.brandName ||
      tenant.branding?.primaryColor ||
      tenant.branding?.logoS3Key
  );

  if (hasOwnBranding) {
    return getResolvedTenantBranding(tenant);
  }

  if (tenant.parentTenantId) {
    const parent = await getTenant(tenant.parentTenantId);
    if (parent) {
      const allowOwn = parent.resellerConfig?.allowSubaccountBranding ?? false;
      if (!allowOwn || !hasOwnBranding) {
        return getResolvedTenantBranding(parent);
      }
    }
  }

  return getResolvedTenantBranding(tenant);
}

export async function resolveBrandingForTenantOrParent(
  tenant: Tenant
): Promise<ResolvedTenantBranding> {
  return getResolvedBrandingWithInheritance(tenant);
}

export async function getLogoUrl(logoS3Key?: string): Promise<string | undefined> {
  if (!logoS3Key) return undefined;
  return getPresignedReadUrl(logoS3Key);
}

export { resolveBranding };
