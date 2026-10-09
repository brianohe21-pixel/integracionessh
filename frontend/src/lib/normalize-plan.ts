import type { TenantPlan } from "@/types";

export type CanonicalTenantPlan = "free" | "starter" | "pro" | "reseller";

export type LegacyTenantPlan = CanonicalTenantPlan | "enterprise" | "scale";

export function normalizeTenantPlan(
  plan: string | undefined | null
): CanonicalTenantPlan {
  if (!plan) return "free";
  if (plan === "enterprise" || plan === "scale") return "pro";
  if (
    plan === "starter" ||
    plan === "pro" ||
    plan === "free" ||
    plan === "reseller"
  ) {
    return plan;
  }
  return "free";
}

export function toTenantPlan(plan: CanonicalTenantPlan | LegacyTenantPlan): TenantPlan {
  return normalizeTenantPlan(plan);
}
