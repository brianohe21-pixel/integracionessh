import type { TenantPlan } from "@/types";

export type AiProvider = "openai";

export type AiModelCategory = "economy" | "flagship" | "reasoning" | "legacy";

export interface AiModelDefinition {
  id: string;
  provider: AiProvider;
  label: string;
  category: AiModelCategory;
  minPlan: TenantPlan;
}

export const DEFAULT_MODEL_ID = "gpt-4.1-mini";

const PLAN_RANK: Record<TenantPlan, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

export const AI_MODELS: AiModelDefinition[] = [
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 Mini",
    category: "economy",
    minPlan: "free",
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o Mini",
    category: "economy",
    minPlan: "free",
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1",
    category: "flagship",
    minPlan: "enterprise",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    category: "flagship",
    minPlan: "enterprise",
  },
  {
    id: "o4-mini",
    provider: "openai",
    label: "o4-mini",
    category: "reasoning",
    minPlan: "enterprise",
  },
  {
    id: "o3-mini",
    provider: "openai",
    label: "o3-mini",
    category: "reasoning",
    minPlan: "enterprise",
  },
  {
    id: "gpt-4-turbo",
    provider: "openai",
    label: "GPT-4 Turbo",
    category: "legacy",
    minPlan: "enterprise",
  },
];

function planMeetsRequirement(plan: TenantPlan, minPlan: TenantPlan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan];
}

export function getModelsForPlan(plan: TenantPlan | string | undefined): AiModelDefinition[] {
  const resolvedPlan: TenantPlan =
    plan === "pro" || plan === "enterprise" || plan === "free" ? plan : "free";
  return AI_MODELS.filter((model) => planMeetsRequirement(resolvedPlan, model.minPlan));
}

export function getModelLabel(modelId: string): string {
  return AI_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}

export const AI_MODEL_CATEGORIES: AiModelCategory[] = [
  "economy",
  "flagship",
  "reasoning",
  "legacy",
];

export function groupModelsByCategory(
  models: AiModelDefinition[]
): Partial<Record<AiModelCategory, AiModelDefinition[]>> {
  const grouped: Partial<Record<AiModelCategory, AiModelDefinition[]>> = {};
  for (const model of models) {
    const list = grouped[model.category] ?? [];
    list.push(model);
    grouped[model.category] = list;
  }
  return grouped;
}
