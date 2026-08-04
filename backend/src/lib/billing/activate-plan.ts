import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import { getResellerPlanDefaults } from "../dynamodb/platform-config.repository.js";
import type { ResellerConfig, Tenant, TenantPlan } from "../../types/index.js";

const PLAN_DURATION_DAYS = 30;

function periodEndFromTenant(tenant: Tenant | null): Date {
  const base = new Date();
  if (tenant?.currentPeriodEnd) {
    const existingEnd = new Date(tenant.currentPeriodEnd);
    if (existingEnd > base) {
      base.setTime(existingEnd.getTime());
    }
  }
  const periodEnd = new Date(base);
  periodEnd.setDate(periodEnd.getDate() + PLAN_DURATION_DAYS);
  return periodEnd;
}

export async function buildResellerConfigFromDefaults(
  existing?: ResellerConfig
): Promise<ResellerConfig> {
  const defaults = await getResellerPlanDefaults();
  return {
    maxSubaccounts: existing?.maxSubaccounts ?? defaults.maxSubaccounts,
    defaultSubaccountPlan:
      existing?.defaultSubaccountPlan ?? defaults.defaultSubaccountPlan,
    allowSubaccountBranding:
      existing?.allowSubaccountBranding ?? defaults.allowSubaccountBranding,
    ...(existing?.customDomain
      ? { customDomain: existing.customDomain }
      : {}),
    customDomainStatus: existing?.customDomainStatus ?? "none",
    ...(existing?.limitsOverride || defaults.limitsOverride
      ? { limitsOverride: existing?.limitsOverride ?? defaults.limitsOverride }
      : {}),
  };
}

export async function activateTenantPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<void> {
  const tenant = await getTenant(tenantId);
  const updates: Partial<Omit<Tenant, "tenantId" | "createdAt">> = {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEndFromTenant(tenant).toISOString(),
    paymentProvider: "wompi",
  };

  if (plan === "reseller") {
    updates.tenantKind = "reseller";
    updates.resellerConfig = await buildResellerConfigFromDefaults(tenant?.resellerConfig);
  }

  await updateTenant(tenantId, updates);
}

export async function applyAdminTenantPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<Tenant> {
  if (plan === "free") {
    return updateTenant(tenantId, {
      plan: "free",
      tenantKind: "standard",
      subscriptionStatus: "none",
      currentPeriodEnd: "",
    });
  }

  const tenant = await getTenant(tenantId);
  const updates: Partial<Omit<Tenant, "tenantId" | "createdAt">> = {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEndFromTenant(tenant).toISOString(),
  };

  if (plan === "reseller") {
    updates.tenantKind = "reseller";
    updates.resellerConfig = await buildResellerConfigFromDefaults(tenant?.resellerConfig);
  } else if (tenant?.tenantKind === "reseller") {
    updates.tenantKind = "standard";
  }

  return updateTenant(tenantId, updates);
}
