import type {
  ResellerLimitsOverride,
  Tenant,
  TenantPlan,
} from "../../types/index.js";

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
  maxChannelsPerBot: number;
  maxActiveWebChatSessions: number;
  maxConcurrentLiveKitCalls: number;
  maxVoicebotMinutesPerMonth: number;
  maxCalendarAppsPerTenant: number;
  maxPaymentsAppsPerTenant: number;
  maxCatalogAppsPerTenant: number;
  maxProductsPerBot: number;
  maxOrdersPerMonth: number;
  canCustomizeBranding: boolean;
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
    maxChannelsPerBot: 1,
    maxActiveWebChatSessions: 0,
    maxConcurrentLiveKitCalls: 0,
    maxVoicebotMinutesPerMonth: 0,
    maxCalendarAppsPerTenant: 1,
    maxPaymentsAppsPerTenant: 1,
    maxCatalogAppsPerTenant: 1,
    maxProductsPerBot: 20,
    maxOrdersPerMonth: 50,
    canCustomizeBranding: false,
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
    maxChannelsPerBot: 4,
    maxActiveWebChatSessions: 50,
    maxConcurrentLiveKitCalls: 2,
    maxVoicebotMinutesPerMonth: 100,
    maxCalendarAppsPerTenant: 5,
    maxPaymentsAppsPerTenant: 5,
    maxCatalogAppsPerTenant: 5,
    maxProductsPerBot: 200,
    maxOrdersPerMonth: 2_000,
    canCustomizeBranding: false,
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
    maxChannelsPerBot: 8,
    maxActiveWebChatSessions: 500,
    maxConcurrentLiveKitCalls: 10,
    maxVoicebotMinutesPerMonth: 1000,
    maxCalendarAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxPaymentsAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxCatalogAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxProductsPerBot: Number.MAX_SAFE_INTEGER,
    maxOrdersPerMonth: Number.MAX_SAFE_INTEGER,
    canCustomizeBranding: true,
    apiRateLimitPerMinute: 120,
    apiRateLimitPerDay: 50_000,
  },
  reseller: {
    maxActiveBots: Number.MAX_SAFE_INTEGER,
    maxMessagesPerMonth: 50_000,
    maxBulkRecipientsPerJob: 10_000,
    maxActiveCampaigns: Number.MAX_SAFE_INTEGER,
    maxContacts: Number.MAX_SAFE_INTEGER,
    maxAutomationsPerBot: Number.MAX_SAFE_INTEGER,
    maxScheduledAutomations: Number.MAX_SAFE_INTEGER,
    maxDocumentsPerBot: 100,
    maxKnowledgeStorageMb: 200,
    maxMetaFlowsPerBot: Number.MAX_SAFE_INTEGER,
    maxVisualFlowsPerBot: Number.MAX_SAFE_INTEGER,
    maxFlowNodes: 100,
    maxActiveFlowRuns: Number.MAX_SAFE_INTEGER,
    maxChannelsPerBot: 8,
    maxActiveWebChatSessions: 500,
    maxConcurrentLiveKitCalls: 10,
    maxVoicebotMinutesPerMonth: 2000,
    maxCalendarAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxPaymentsAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxCatalogAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxProductsPerBot: Number.MAX_SAFE_INTEGER,
    maxOrdersPerMonth: Number.MAX_SAFE_INTEGER,
    canCustomizeBranding: true,
    apiRateLimitPerMinute: 200,
    apiRateLimitPerDay: 100_000,
  },
};

function applyLimitsOverride(
  base: PlanLimits,
  override?: ResellerLimitsOverride
): PlanLimits {
  if (!override) return base;
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([, value]) => value !== undefined)
    ),
  } as PlanLimits;
}

export function getPlanLimits(plan: TenantPlan | string | undefined): PlanLimits {
  if (
    plan === "pro" ||
    plan === "enterprise" ||
    plan === "free" ||
    plan === "reseller"
  ) {
    return LIMITS[plan];
  }
  return LIMITS.free;
}

function emptyNumericLimits(canCustomizeBranding: boolean): PlanLimits {
  return {
    maxActiveBots: 0,
    maxMessagesPerMonth: 0,
    maxBulkRecipientsPerJob: 0,
    maxActiveCampaigns: 0,
    maxContacts: 0,
    maxAutomationsPerBot: 0,
    maxScheduledAutomations: 0,
    maxDocumentsPerBot: 0,
    maxKnowledgeStorageMb: 0,
    maxMetaFlowsPerBot: 0,
    maxVisualFlowsPerBot: 0,
    maxFlowNodes: 0,
    maxActiveFlowRuns: 0,
    maxChannelsPerBot: 0,
    maxActiveWebChatSessions: 0,
    maxConcurrentLiveKitCalls: 0,
    maxVoicebotMinutesPerMonth: 0,
    maxCalendarAppsPerTenant: 0,
    maxPaymentsAppsPerTenant: 0,
    maxCatalogAppsPerTenant: 0,
    maxProductsPerBot: 0,
    maxOrdersPerMonth: 0,
    canCustomizeBranding,
    apiRateLimitPerMinute: 0,
    apiRateLimitPerDay: 0,
  };
}

export function getEffectivePlanLimits(tenant: Tenant): PlanLimits {
  const base = getPlanLimits(tenant.plan);
  if (tenant.plan === "reseller" && tenant.resellerConfig?.limitsOverride) {
    return applyLimitsOverride(base, tenant.resellerConfig.limitsOverride);
  }

  const isSubaccount = tenant.tenantKind === "subaccount" || Boolean(tenant.parentTenantId);
  if (isSubaccount && tenant.serviceLimits !== undefined) {
    return applyLimitsOverride(
      emptyNumericLimits(base.canCustomizeBranding),
      tenant.serviceLimits
    );
  }

  return base;
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
  if (tenant.plan === "reseller" && (status === "active" || status === "trialing" || status === "none")) {
    if (status === "active" || status === "trialing") return;
    if (status === "none") return;
  }

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
