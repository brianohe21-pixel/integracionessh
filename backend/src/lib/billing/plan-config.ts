import type { Tenant, TenantPlan } from "../../types/index.js";
import { PlanLimitError } from "./plan-limits.js";
import {
  getModelDefinition,
  getModelsForPlan,
  isModelAllowedForPlan,
  isValidModelId,
  type AiModelDefinition,
} from "../ai/models.js";

export type AllowedModel = string;

export const WOMPI_AMOUNT_PRO_CENTS_DEFAULT = 17_990_000;
export const WOMPI_AMOUNT_ENTERPRISE_CENTS_DEFAULT = 74_990_000;

export function getAllowedModelsForPlan(plan: TenantPlan | string | undefined): AllowedModel[] {
  return getModelsForPlan(plan).map((model) => model.id);
}

export function getAllowedModelDefinitionsForPlan(
  plan: TenantPlan | string | undefined
): AiModelDefinition[] {
  return getModelsForPlan(plan);
}

export function assertAllowedModel(tenant: Tenant, model: string | undefined): void {
  if (!model) return;
  if (!isValidModelId(model)) {
    throw new PlanLimitError("PLAN_MODEL_NOT_ALLOWED", `Unknown model: ${model}`);
  }
  if (!isModelAllowedForPlan(tenant.plan, model)) {
    const definition = getModelDefinition(model);
    throw new PlanLimitError(
      "PLAN_MODEL_NOT_ALLOWED",
      `Model ${definition?.label ?? model} is not available on the ${tenant.plan} plan. Upgrade to Enterprise for advanced models.`
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
