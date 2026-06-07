import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import type { Tenant, TenantPlan } from "../../types/index.js";

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

export async function activateTenantPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<void> {
  const tenant = await getTenant(tenantId);
  await updateTenant(tenantId, {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEndFromTenant(tenant).toISOString(),
    paymentProvider: "wompi",
  });
}

export async function applyAdminTenantPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<Tenant> {
  if (plan === "free") {
    return updateTenant(tenantId, {
      plan: "free",
      subscriptionStatus: "none",
      currentPeriodEnd: "",
    });
  }

  const tenant = await getTenant(tenantId);
  return updateTenant(tenantId, {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEndFromTenant(tenant).toISOString(),
  });
}
