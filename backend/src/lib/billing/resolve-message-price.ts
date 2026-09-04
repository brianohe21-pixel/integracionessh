import type { Tenant } from "../../types/index.js";

export function resolveTenantPricePerMessageCents(
  tenant: Pick<Tenant, "pricePerMessageCents">,
  platformPricePerMessageCents: number
): number {
  return tenant.pricePerMessageCents ?? platformPricePerMessageCents;
}

export function tenantUsesCustomMessagePrice(
  tenant: Pick<Tenant, "pricePerMessageCents">
): boolean {
  return tenant.pricePerMessageCents !== undefined;
}
