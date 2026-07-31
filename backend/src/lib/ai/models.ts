import type { TenantPlan } from "../../types/index.js";

export type AiProvider = "openai" | "anthropic";

export type AiModelCategory = "economy" | "flagship" | "reasoning" | "legacy";

export interface AiModelDefinition {
  id: string;
  provider: AiProvider;
  label: string;
  category: AiModelCategory;
  minPlan: TenantPlan;
  supportsTools: boolean;
  supportsTemperature: boolean;
  usesCompletionTokens: boolean;
  defaultTemperature?: number;
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
    supportsTools: true,
    supportsTemperature: true,
    usesCompletionTokens: false,
    defaultTemperature: 0.7,
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o Mini",
    category: "economy",
    minPlan: "free",
    supportsTools: true,
    supportsTemperature: true,
    usesCompletionTokens: false,
    defaultTemperature: 0.7,
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1",
    category: "flagship",
    minPlan: "enterprise",
    supportsTools: true,
    supportsTemperature: true,
    usesCompletionTokens: false,
    defaultTemperature: 0.7,
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    category: "flagship",
    minPlan: "enterprise",
    supportsTools: true,
    supportsTemperature: true,
    usesCompletionTokens: false,
    defaultTemperature: 0.7,
  },
  {
    id: "o4-mini",
    provider: "openai",
    label: "o4-mini",
    category: "reasoning",
    minPlan: "enterprise",
    supportsTools: true,
    supportsTemperature: false,
    usesCompletionTokens: true,
  },
  {
    id: "o3-mini",
    provider: "openai",
    label: "o3-mini",
    category: "reasoning",
    minPlan: "enterprise",
    supportsTools: true,
    supportsTemperature: false,
    usesCompletionTokens: true,
  },
  {
    id: "gpt-4-turbo",
    provider: "openai",
    label: "GPT-4 Turbo",
    category: "legacy",
    minPlan: "enterprise",
    supportsTools: true,
    supportsTemperature: true,
    usesCompletionTokens: false,
    defaultTemperature: 0.7,
  },
];

const MODEL_MAP = new Map(AI_MODELS.map((model) => [model.id, model]));

export function getModelDefinition(modelId: string): AiModelDefinition | undefined {
  return MODEL_MAP.get(modelId);
}

export function isValidModelId(modelId: string): boolean {
  return MODEL_MAP.has(modelId);
}

function planMeetsRequirement(plan: TenantPlan, minPlan: TenantPlan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan];
}

export function getModelsForPlan(plan: TenantPlan | string | undefined): AiModelDefinition[] {
  const resolvedPlan: TenantPlan =
    plan === "pro" || plan === "enterprise" || plan === "free" ? plan : "free";
  return AI_MODELS.filter((model) => planMeetsRequirement(resolvedPlan, model.minPlan));
}

export function isModelAllowedForPlan(
  plan: TenantPlan | string | undefined,
  modelId: string
): boolean {
  const definition = getModelDefinition(modelId);
  if (!definition) return false;
  const resolvedPlan: TenantPlan =
    plan === "pro" || plan === "enterprise" || plan === "free" ? plan : "free";
  return planMeetsRequirement(resolvedPlan, definition.minPlan);
}

export function resolveModelId(modelId: string | undefined): string {
  if (modelId && isValidModelId(modelId)) return modelId;
  return DEFAULT_MODEL_ID;
}

export function resolveBotProvider(
  modelId: string | undefined,
  aiProvider?: AiProvider
): AiProvider {
  if (aiProvider) return aiProvider;
  const definition = getModelDefinition(resolveModelId(modelId));
  return definition?.provider ?? "openai";
}

export function getModelProviderMismatch(
  modelId: string,
  aiProvider?: AiProvider
): string | null {
  const definition = getModelDefinition(modelId);
  if (!definition) return `Unknown model: ${modelId}`;
  if (aiProvider && aiProvider !== definition.provider) {
    return `Model ${modelId} does not belong to provider ${aiProvider}`;
  }
  return null;
}
