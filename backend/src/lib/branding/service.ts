import { getPresignedReadUrl } from "../s3/client.js";
import type { ResolvedTenantBranding, Tenant } from "../../types/index.js";
import { resolveBranding } from "./resolve.js";

export async function getResolvedTenantBranding(
  tenant: Tenant
): Promise<ResolvedTenantBranding> {
  const logoS3Key = tenant.branding?.logoS3Key;
  let logoUrl: string | undefined;
  if (logoS3Key) {
    try {
      logoUrl = await getPresignedReadUrl(logoS3Key);
    } catch (error) {
      console.error("Failed to resolve branding logo URL", {
        tenantId: tenant.tenantId,
        logoS3Key,
        error,
      });
    }
  }
  return resolveBranding(tenant, logoUrl);
}
