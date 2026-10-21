import type { Tenant, TenantPlan } from "@/types";
import {
  getModelsForPlan,
  type AiModelDefinition,
} from "@/lib/ai-models";
import type { BillingPlanPrice } from "@/hooks/useBilling";
import { normalizeTenantPlan } from "@/lib/normalize-plan";
import { buildWaMeLink } from "@/lib/wa-link";

const MAX_WHATSAPP_CHANNELS_PER_BOT_BY_PLAN: Record<
  ReturnType<typeof normalizeTenantPlan>,
  number
> = {
  free: 1,
  starter: 3,
  pro: 5,
  reseller: Number.MAX_SAFE_INTEGER,
};

export function getMaxWhatsAppChannelsPerBot(
  tenant: Tenant | undefined | null
): number {
  if (!tenant) return 1;

  const plan = normalizeTenantPlan(tenant.plan);
  const base = MAX_WHATSAPP_CHANNELS_PER_BOT_BY_PLAN[plan];
  const isSubaccount =
    tenant.tenantKind === "subaccount" || Boolean(tenant.parentTenantId);

  if (isSubaccount && tenant.serviceLimits?.maxWhatsAppChannelsPerBot != null) {
    return tenant.serviceLimits.maxWhatsAppChannelsPerBot;
  }

  if (
    plan === "reseller" &&
    tenant.resellerConfig?.limitsOverride?.maxWhatsAppChannelsPerBot != null
  ) {
    return tenant.resellerConfig.limitsOverride.maxWhatsAppChannelsPerBot;
  }

  if (
    plan === "pro" &&
    !isSubaccount &&
    tenant.planLimitsOverride?.maxWhatsAppChannelsPerBot != null
  ) {
    return tenant.planLimitsOverride.maxWhatsAppChannelsPerBot;
  }

  return base;
}

export type AllowedModel = string;
export type PaidBillingPlan = "starter" | "pro";

export const PLAN_LIST_PRICE_USD: Record<PaidBillingPlan, number> = {
  starter: 80,
  pro: 199,
};

export const PUBLIC_SELF_SERVICE_PLAN: PaidBillingPlan = "starter";

export const SALES_WHATSAPP_URL =
  buildWaMeLink("+573217455642") ?? "https://wa.me/573217455642";

export function resolveBillingPlanPrice(
  plans:
    | {
        starter?: BillingPlanPrice;
        pro?: BillingPlanPrice;
      }
    | undefined,
  plan: PaidBillingPlan
): BillingPlanPrice | undefined {
  if (!plans) return undefined;
  return plans[plan];
}

export const PRO_PLAN_CATALOG_LIMITS = {
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
  maxWhatsAppChannelsPerBot: 5,
  maxActiveWebChatSessions: 200,
  maxConcurrentLiveKitCalls: 3,
  maxVoicebotMinutesPerMonth: 300,
  maxCalendarAppsPerTenant: 5,
  maxPaymentsAppsPerTenant: 5,
  maxCatalogAppsPerTenant: 5,
  maxHostedFormsPerTenant: 10,
  maxProductsPerBot: 200,
  maxOrdersPerMonth: 2_000,
  apiRateLimitPerMinute: 120,
  apiRateLimitPerDay: 50_000,
} as const;

export const RESELLER_PLAN_CATALOG_LIMITS: Record<
  keyof typeof PRO_PLAN_CATALOG_LIMITS,
  number
> = {
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
  apiRateLimitPerMinute: 200,
  apiRateLimitPerDay: 100_000,
};

export type ProPlanLimitKey = keyof typeof PRO_PLAN_CATALOG_LIMITS;

export const PRO_PLAN_LIMIT_KEYS = Object.keys(
  PRO_PLAN_CATALOG_LIMITS
) as ProPlanLimitKey[];

export function getAdminQuotaCatalog(
  plan: TenantPlan | string | undefined
): Record<ProPlanLimitKey, number> {
  return normalizeTenantPlan(plan) === "reseller"
    ? RESELLER_PLAN_CATALOG_LIMITS
    : PRO_PLAN_CATALOG_LIMITS;
}

export function isUnlimitedPlanLimit(value: number): boolean {
  return value >= Number.MAX_SAFE_INTEGER / 2;
}

export function getAllowedModelsForPlan(plan: TenantPlan | string | undefined): AllowedModel[] {
  return getModelsForPlan(plan).map((model) => model.id);
}

export function getAllowedModelDefinitionsForPlan(
  plan: TenantPlan | string | undefined
): AiModelDefinition[] {
  return getModelsForPlan(plan);
}

export function formatCopPrice(amountCents: number): string {
  const pesos = Math.round(amountCents / 100);
  return `$${pesos.toLocaleString("es-CO")} COP`;
}

export function formatUsdPrice(amountUsd: number): string {
  return `USD ${amountUsd.toLocaleString("en-US")}`;
}
