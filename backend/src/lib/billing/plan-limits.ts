import type { Tenant, TenantPlan } from "../../types/index.js";

export interface PlanLimits {
  maxActiveBots: number;
  maxMessagesPerMonth: number;
  maxBulkRecipientsPerJob: number;
  maxActiveCampaigns: number;
  maxContacts: number;
  maxAutomationsPerBot: number;
  maxScheduledAutomations: number;
  maxDocumentsPerBot: number;
  maxKnowledgeStorageMb: number;
  maxMetaFlowsPerBot: number;
  maxVisualFlowsPerBot: number;
  maxFlowNodes: number;
  maxActiveFlowRuns: number;
  apiRateLimitPerMinute: number;
  apiRateLimitPerDay: number;
}

const LIMITS: Record<TenantPlan, PlanLimits> = {
  free: {
    maxActiveBots: 1,
    maxMessagesPerMonth: 250,
    maxBulkRecipientsPerJob: 50,
    maxActiveCampaigns: 1,
    maxContacts: 250,
    maxAutomationsPerBot: 2,
    maxScheduledAutomations: 1,
    maxDocumentsPerBot: 0,
    maxKnowledgeStorageMb: 0,
    maxMetaFlowsPerBot: 1,
    maxVisualFlowsPerBot: 1,
    maxFlowNodes: 10,
    maxActiveFlowRuns: 3,
    apiRateLimitPerMinute: 20,
    apiRateLimitPerDay: 250,
  },
  pro: {
    maxActiveBots: 5,
    maxMessagesPerMonth: 4_000,
    maxBulkRecipientsPerJob: 2_000,
    maxActiveCampaigns: 5,
    maxContacts: 5_000,
    maxAutomationsPerBot: 15,
    maxScheduledAutomations: 5,
    maxDocumentsPerBot: 10,
    maxKnowledgeStorageMb: 25,
    maxMetaFlowsPerBot: 5,
    maxVisualFlowsPerBot: 5,
    maxFlowNodes: 40,
    maxActiveFlowRuns: 50,
    apiRateLimitPerMinute: 60,
    apiRateLimitPerDay: 5_000,
  },
  enterprise: {
    maxActiveBots: Number.MAX_SAFE_INTEGER,
    maxMessagesPerMonth: 15_000,
    maxBulkRecipientsPerJob: 10_000,
    maxActiveCampaigns: Number.MAX_SAFE_INTEGER,
    maxContacts: Number.MAX_SAFE_INTEGER,
    maxAutomationsPerBot: Number.MAX_SAFE_INTEGER,
    maxScheduledAutomations: Number.MAX_SAFE_INTEGER,
    maxDocumentsPerBot: 50,
    maxKnowledgeStorageMb: 100,
    maxMetaFlowsPerBot: Number.MAX_SAFE_INTEGER,
    maxVisualFlowsPerBot: Number.MAX_SAFE_INTEGER,
    maxFlowNodes: 100,
    maxActiveFlowRuns: Number.MAX_SAFE_INTEGER,
    apiRateLimitPerMinute: 120,
    apiRateLimitPerDay: 50_000,
  },
};

export function getPlanLimits(plan: TenantPlan | string | undefined): PlanLimits {
  if (plan === "pro" || plan === "enterprise" || plan === "free") {
    return LIMITS[plan];
  }
  return LIMITS.free;
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
