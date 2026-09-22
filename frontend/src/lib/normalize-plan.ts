import type { TenantPlan } from "@/types";

export type CanonicalTenantPlan = "free" | "starter" | "pro" | "scale" | "reseller";

export type LegacyTenantPlan = CanonicalTenantPlan | "enterprise";

export function normalizeTenantPlan(
  plan: string | undefined | null
): CanonicalTenantPlan {
  if (!plan) return "free";
  if (plan === "enterprise") return "pro";
  if (
    plan === "starter" ||
    plan === "pro" ||
    plan === "scale" ||
    plan === "free" ||
    plan === "reseller"
  ) {
    return plan;
  }
  return "free";
}

export function isScaleOrResellerPlan(plan: string | undefined | null): boolean {
  const normalized = normalizeTenantPlan(plan);
  return normalized === "scale" || normalized === "reseller";
}

export function toTenantPlan(plan: CanonicalTenantPlan | LegacyTenantPlan): TenantPlan {
  return normalizeTenantPlan(plan);
}
