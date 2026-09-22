import type { Tenant } from "../../types/index.js";
import type { PaidTenantPlan } from "./plan-config.js";
import { PlanLimitError } from "./plan-limits.js";

export function isSelfServiceCheckoutPlan(plan: PaidTenantPlan): boolean {
  return plan === "starter";
}

export function canCheckoutPlan(tenant: Tenant, plan: PaidTenantPlan): boolean {
  if (plan === "starter") return true;
  if (plan === "scale") return tenant.plan === "scale";
  return false;
}

export function assertCheckoutAllowed(tenant: Tenant, plan: PaidTenantPlan): void {
  if (canCheckoutPlan(tenant, plan)) return;
  if (plan === "pro") {
    throw new PlanLimitError(
      "BILLING_SALES_ONLY",
      "Pro plan requires contacting the sales team"
    );
  }
  throw new PlanLimitError(
    "BILLING_SALES_ONLY",
    "This plan is not available for self-service checkout"
  );
}
