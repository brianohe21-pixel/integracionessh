import { fetchAuthSession } from "aws-amplify/auth";

export const ADMIN_HOME = "/admin/users";
export const MEMBER_HOME = "/bots";
export const ADVISOR_HOME = "/inbox";

const PENDING_BILLING_PLAN_KEY = "pendingBillingPlan";

export type PaidBillingPlan = "pro" | "enterprise";

export function isPaidBillingPlan(value: string | null | undefined): value is PaidBillingPlan {
  return value === "pro" || value === "enterprise";
}

export function billingPlanFromRedirect(redirect: string | null | undefined): PaidBillingPlan | null {
  if (!redirect) return null;
  if (redirect.includes("plan=enterprise")) return "enterprise";
  if (redirect.includes("plan=pro")) return "pro";
  return null;
}

export function billingRedirectForPlan(plan: PaidBillingPlan): string {
  return `/billing?plan=${plan}`;
}

export function storePendingBillingPlan(plan: PaidBillingPlan): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_BILLING_PLAN_KEY, plan);
}

export function consumePendingBillingRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const plan = localStorage.getItem(PENDING_BILLING_PLAN_KEY);
  if (!isPaidBillingPlan(plan)) return null;
  localStorage.removeItem(PENDING_BILLING_PLAN_KEY);
  return billingRedirectForPlan(plan);
}

export async function getPostLoginPath(redirect?: string | null): Promise<string> {
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    if (typeof window !== "undefined") {
      localStorage.removeItem(PENDING_BILLING_PLAN_KEY);
    }
    return redirect;
  }

  const billingRedirect = consumePendingBillingRedirect();
  if (billingRedirect) return billingRedirect;

  try {
    const session = await fetchAuthSession();
    const role = session.tokens?.idToken?.payload?.["custom:role"];
    if (role === "admin") return ADMIN_HOME;
    if (role === "advisor") return ADVISOR_HOME;
    return MEMBER_HOME;
  } catch {
    return MEMBER_HOME;
  }
}
