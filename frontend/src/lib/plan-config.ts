import type { TenantPlan } from "@/types";
import {
  getModelsForPlan,
  type AiModelDefinition,
} from "@/lib/ai-models";
import type { BillingPlanPrice } from "@/hooks/useBilling";

export type AllowedModel = string;
export type PaidBillingPlan = "starter" | "pro" | "scale";

export const PLAN_LIST_PRICE_USD: Record<PaidBillingPlan, number> = {
  starter: 59,
  pro: 199,
  scale: 699,
};

export function resolveBillingPlanPrice(
  plans:
    | {
        starter?: BillingPlanPrice;
        pro?: BillingPlanPrice;
        scale?: BillingPlanPrice;
        enterprise?: BillingPlanPrice;
      }
    | undefined,
  plan: PaidBillingPlan
): BillingPlanPrice | undefined {
  if (!plans) return undefined;
  return plans[plan] ?? (plan === "scale" ? plans.enterprise : undefined);
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
