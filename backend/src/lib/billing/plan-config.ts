import type { Tenant, TenantPlan } from "../../types/index.js";
import { PlanLimitError } from "./plan-limits.js";

export const WOMPI_AMOUNT_PRO_CENTS_DEFAULT = 17_990_000;
export const WOMPI_AMOUNT_ENTERPRISE_CENTS_DEFAULT = 74_990_000;

export type AllowedModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";

const ALLOWED_MODELS: Record<TenantPlan, AllowedModel[]> = {
  free: ["gpt-4o-mini"],
  pro: ["gpt-4o-mini"],
  enterprise: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
};

export function getAllowedModelsForPlan(plan: TenantPlan | string | undefined): AllowedModel[] {
  if (plan === "pro" || plan === "enterprise" || plan === "free") {
    return ALLOWED_MODELS[plan];
  }
  return ALLOWED_MODELS.free;
}

export function assertAllowedModel(tenant: Tenant, model: string | undefined): void {
  if (!model) return;
  const allowed = getAllowedModelsForPlan(tenant.plan);
  if (!allowed.includes(model as AllowedModel)) {
    throw new PlanLimitError(
      "PLAN_MODEL_NOT_ALLOWED",
      `Model ${model} is not available on the ${tenant.plan} plan. Upgrade to Enterprise for advanced models.`
    );
  }
}

export function assertCanEnableKnowledge(tenant: Tenant): void {
  if (tenant.plan === "free") {
    throw new PlanLimitError(
      "PLAN_KNOWLEDGE_NOT_AVAILABLE",
      "Knowledge base requires a Pro or Enterprise plan"
    );
  }
}
