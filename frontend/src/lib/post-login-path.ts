import { fetchAuthSession } from "aws-amplify/auth";

export const ADMIN_HOME = "/admin/users";
export const MEMBER_HOME = "/bots";
export const ADVISOR_HOME = "/inbox";

const PENDING_BILLING_PLAN_KEY = "pendingBillingPlan";

export function storePendingBillingPlan(plan: "pro" | "enterprise"): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_BILLING_PLAN_KEY, plan);
}

export function consumePendingBillingRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const plan = sessionStorage.getItem(PENDING_BILLING_PLAN_KEY);
  if (plan !== "pro" && plan !== "enterprise") return null;
  sessionStorage.removeItem(PENDING_BILLING_PLAN_KEY);
  return `/billing?plan=${plan}`;
}

export async function getPostLoginPath(redirect?: string | null): Promise<string> {
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PENDING_BILLING_PLAN_KEY);
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
