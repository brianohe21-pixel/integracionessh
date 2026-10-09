import { normalizeTenantPlan } from "@/lib/normalize-plan";
import type { TenantPlan } from "@/types";

export function isProPlusPlan(plan: TenantPlan | string | undefined): boolean {
  const normalized = normalizeTenantPlan(plan);
  return normalized === "pro" || normalized === "reseller";
}

export function isProOnlyNavPath(href: string): boolean {
  const path = (href.split("?")[0] ?? href).toLowerCase();
  return (
    path === "/voice-agents" ||
    path.startsWith("/voice-agents/") ||
    path === "/contact-center" ||
    path.startsWith("/contact-center/")
  );
}

export function isNavLockedForPlan(href: string, plan: TenantPlan | undefined): boolean {
  return isProOnlyNavPath(href) && !isProPlusPlan(plan);
}

export function isNavItemPlanLocked(
  item: { href: string; items?: { href: string }[] },
  plan: TenantPlan | undefined
): boolean {
  if (isNavLockedForPlan(item.href, plan)) return true;
  return Boolean(item.items?.some((child) => isNavLockedForPlan(child.href, plan)));
}
