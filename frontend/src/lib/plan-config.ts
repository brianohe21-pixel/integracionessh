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

export const SALES_WHATSAPP_URL = buildWaMeLink("+573217455642");

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
