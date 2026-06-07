import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import type { TenantPlan } from "../../types/index.js";

const PLAN_DURATION_DAYS = 30;

export async function activateTenantPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<void> {
  const tenant = await getTenant(tenantId);
  const base = new Date();
  if (tenant?.currentPeriodEnd) {
    const existingEnd = new Date(tenant.currentPeriodEnd);
    if (existingEnd > base) {
      base.setTime(existingEnd.getTime());
    }
  }

  const periodEnd = new Date(base);
  periodEnd.setDate(periodEnd.getDate() + PLAN_DURATION_DAYS);

  await updateTenant(tenantId, {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEnd.toISOString(),
    paymentProvider: "wompi",
  });
}
