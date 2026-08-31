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
  maxWhatsAppChannelsPerBot: number;
  maxActiveWebChatSessions: number;
  maxConcurrentLiveKitCalls: number;
  maxVoicebotMinutesPerMonth: number;
  maxCalendarAppsPerTenant: number;
  maxPaymentsAppsPerTenant: number;
  maxCatalogAppsPerTenant: number;
  maxHostedFormsPerTenant: number;
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
    maxWhatsAppChannelsPerBot: 1,
    maxActiveWebChatSessions: 0,
    maxConcurrentLiveKitCalls: 0,
    maxVoicebotMinutesPerMonth: 0,
    maxCalendarAppsPerTenant: 1,
    maxPaymentsAppsPerTenant: 1,
    maxCatalogAppsPerTenant: 1,
    maxHostedFormsPerTenant: 1,
    maxProductsPerBot: 20,
    maxOrdersPerMonth: 50,
    canCustomizeBranding: false,
    apiRateLimitPerMinute: 20,
    apiRateLimitPerDay: 250,
  },
  starter: {
    maxActiveBots: 2,
    maxMessagesPerMonth: 2_000,
    maxBulkRecipientsPerJob: 500,
    maxActiveCampaigns: 2,
    maxContacts: 2_000,
    maxAutomationsPerBot: 5,
    maxScheduledAutomations: 2,
    maxDocumentsPerBot: 5,
    maxKnowledgeStorageMb: 25,
    maxMetaFlowsPerBot: 2,
    maxVisualFlowsPerBot: 2,
    maxFlowNodes: 20,
    maxActiveFlowRuns: 15,
    maxChannelsPerBot: 2,
    maxWhatsAppChannelsPerBot: 1,
    maxActiveWebChatSessions: 25,
    maxConcurrentLiveKitCalls: 1,
    maxVoicebotMinutesPerMonth: 60,
    maxCalendarAppsPerTenant: 2,
    maxPaymentsAppsPerTenant: 2,
    maxCatalogAppsPerTenant: 2,
    maxHostedFormsPerTenant: 3,
    maxProductsPerBot: 50,
    maxOrdersPerMonth: 500,
    canCustomizeBranding: false,
    apiRateLimitPerMinute: 30,
    apiRateLimitPerDay: 2_500,
  },
  pro: {
    maxActiveBots: 5,
    maxMessagesPerMonth: 10_000,
    maxBulkRecipientsPerJob: 2_000,
    maxActiveCampaigns: 10,
    maxContacts: 10_000,
    maxAutomationsPerBot: 20,
    maxScheduledAutomations: 10,
    maxDocumentsPerBot: 25,
    maxKnowledgeStorageMb: 150,
    maxMetaFlowsPerBot: 10,
    maxVisualFlowsPerBot: 10,
    maxFlowNodes: 40,
    maxActiveFlowRuns: 50,
    maxChannelsPerBot: 5,
    maxWhatsAppChannelsPerBot: 1,
    maxActiveWebChatSessions: 200,
    maxConcurrentLiveKitCalls: 3,
    maxVoicebotMinutesPerMonth: 300,
    maxCalendarAppsPerTenant: 5,
    maxPaymentsAppsPerTenant: 5,
    maxCatalogAppsPerTenant: 5,
    maxHostedFormsPerTenant: 10,
    maxProductsPerBot: 200,
    maxOrdersPerMonth: 2_000,
    canCustomizeBranding: true,
    apiRateLimitPerMinute: 120,
    apiRateLimitPerDay: 50_000,
  },
  scale: {
    maxActiveBots: 15,
    maxMessagesPerMonth: 40_000,
    maxBulkRecipientsPerJob: 10_000,
    maxActiveCampaigns: 50,
    maxContacts: 50_000,
    maxAutomationsPerBot: 100,
    maxScheduledAutomations: 50,
    maxDocumentsPerBot: 100,
    maxKnowledgeStorageMb: 1024,
    maxMetaFlowsPerBot: 50,
    maxVisualFlowsPerBot: 50,
    maxFlowNodes: 100,
    maxActiveFlowRuns: 500,
    maxChannelsPerBot: 8,
    maxWhatsAppChannelsPerBot: 60,
    maxActiveWebChatSessions: 1_000,
    maxConcurrentLiveKitCalls: 10,
    maxVoicebotMinutesPerMonth: 1_000,
    maxCalendarAppsPerTenant: 10,
    maxPaymentsAppsPerTenant: 10,
    maxCatalogAppsPerTenant: 10,
    maxHostedFormsPerTenant: 50,
    maxProductsPerBot: 1_000,
    maxOrdersPerMonth: 10_000,
    canCustomizeBranding: true,
    apiRateLimitPerMinute: 300,
    apiRateLimitPerDay: 250_000,
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
    maxWhatsAppChannelsPerBot: Number.MAX_SAFE_INTEGER,
    maxActiveWebChatSessions: 500,
    maxConcurrentLiveKitCalls: 10,
    maxVoicebotMinutesPerMonth: 2000,
    maxCalendarAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxPaymentsAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxCatalogAppsPerTenant: Number.MAX_SAFE_INTEGER,
    maxHostedFormsPerTenant: Number.MAX_SAFE_INTEGER,
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

import { normalizeTenantPlan } from "./normalize-plan.js";

export function getPlanLimits(plan: TenantPlan | string | undefined): PlanLimits {
  const normalized = normalizeTenantPlan(plan);
  if (
    normalized === "starter" ||
    normalized === "pro" ||
    normalized === "scale" ||
    normalized === "free" ||
    normalized === "reseller"
  ) {
    return LIMITS[normalized];
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
    maxWhatsAppChannelsPerBot: 0,
    maxActiveWebChatSessions: 0,
    maxConcurrentLiveKitCalls: 0,
    maxVoicebotMinutesPerMonth: 0,
    maxCalendarAppsPerTenant: 0,
    maxPaymentsAppsPerTenant: 0,
    maxCatalogAppsPerTenant: 0,
    maxHostedFormsPerTenant: 0,
    maxProductsPerBot: 0,
    maxOrdersPerMonth: 0,
    canCustomizeBranding,
    apiRateLimitPerMinute: 0,
    apiRateLimitPerDay: 0,
  };
}

export function getEffectivePlanLimits(tenant: Tenant): PlanLimits {
  const base = getPlanLimits(normalizeTenantPlan(tenant.plan));
  if (tenant.plan === "reseller" && tenant.resellerConfig?.limitsOverride) {
    return {
      ...applyLimitsOverride(base, tenant.resellerConfig.limitsOverride),
      canCustomizeBranding: true,
    };
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
