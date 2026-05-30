import type { Tenant, TenantPlan } from "../../types/index.js";

export interface PlanLimits {
  maxActiveBots: number;
  maxMessagesPerMonth: number;
  maxBulkRecipientsPerJob: number;
  maxActiveCampaigns: number;
}

const LIMITS: Record<TenantPlan, PlanLimits> = {
  free: {
    maxActiveBots: 1,
    maxMessagesPerMonth: 500,
    maxBulkRecipientsPerJob: 100,
    maxActiveCampaigns: 1,
  },
  pro: {
    maxActiveBots: 5,
    maxMessagesPerMonth: 10_000,
    maxBulkRecipientsPerJob: 5_000,
    maxActiveCampaigns: 10,
  },
  enterprise: {
    maxActiveBots: Number.MAX_SAFE_INTEGER,
    maxMessagesPerMonth: 100_000,
    maxBulkRecipientsPerJob: 50_000,
    maxActiveCampaigns: Number.MAX_SAFE_INTEGER,
  },
};

export function getPlanLimits(plan: TenantPlan): PlanLimits {
  return LIMITS[plan];
}

export function isUnlimited(value: number): boolean {
  return value >= Number.MAX_SAFE_INTEGER / 2;
}

export class PlanLimitError extends Error {
  statusCode = 402;
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function assertSubscriptionAllowsSending(tenant: Tenant): void {
  const status = tenant.subscriptionStatus ?? "none";
  if (tenant.plan === "free" && status === "none") return;

  if (status === "active" || status === "trialing") return;

  if (status === "canceled" && tenant.currentPeriodEnd) {
    if (new Date(tenant.currentPeriodEnd).getTime() > Date.now()) return;
  }

  if (status === "past_due" || status === "canceled" || status === "none") {
    throw new PlanLimitError(
      "SUBSCRIPTION_INACTIVE",
      "Active subscription required for this action"
    );
  }
}
