import { updateTenant } from "../dynamodb/tenant.repository.js";
import type { TenantPlan } from "../../types/index.js";

const PLAN_DURATION_DAYS = 30;

export async function activateTenantPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<void> {
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + PLAN_DURATION_DAYS);

  await updateTenant(tenantId, {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEnd.toISOString(),
    paymentProvider: "wompi",
  });
}
