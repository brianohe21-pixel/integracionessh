import type { TenantPlan } from "@/types";
import {
  getModelsForPlan,
  type AiModelDefinition,
} from "@/lib/ai-models";
import type { BillingPlanPrice } from "@/hooks/useBilling";
import { buildWaMeLink } from "@/lib/wa-link";

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

export type ProPlanLimitKey = keyof typeof PRO_PLAN_CATALOG_LIMITS;

export const PRO_PLAN_LIMIT_KEYS = Object.keys(
  PRO_PLAN_CATALOG_LIMITS
) as ProPlanLimitKey[];

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
