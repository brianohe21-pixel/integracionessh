import { getPresignedReadUrl } from "../s3/client.js";
import type { ResolvedTenantBranding, Tenant } from "../../types/index.js";
import { resolveBranding } from "./resolve.js";

export async function getResolvedTenantBranding(
  tenant: Tenant
): Promise<ResolvedTenantBranding> {
  const logoS3Key = tenant.branding?.logoS3Key;
  const logoUrl = logoS3Key ? await getPresignedReadUrl(logoS3Key) : undefined;
  return resolveBranding(tenant, logoUrl);
}
