import {
  AI_MODELS,
  AI_MODEL_CATEGORIES,
  getModelsForPlan,
  type AiModelCategory,
} from "@/lib/ai-models";
import {
  REALTIME_MODELS,
  getRealtimeModel,
  type RealtimeModelTier,
} from "@/lib/realtime-models";
import type { TenantPlan } from "@/types";

export type AssistantModelGroup = "realtime" | AiModelCategory;
export type AssistantModelKind = "realtime" | "chat";

export interface AssistantModelOption {
  id: string;
  label: string;
  description?: string;
  group: AssistantModelGroup;
  kind: AssistantModelKind;
  tier?: RealtimeModelTier;
  category?: AiModelCategory;
  minPlan?: TenantPlan;
  provider: "openai";
}

export const ASSISTANT_MODEL_GROUPS: AssistantModelGroup[] = [
  "realtime",
  ...AI_MODEL_CATEGORIES,
];

function toRealtimeOptions(): AssistantModelOption[] {
  return REALTIME_MODELS.map((model) => ({
    id: model.id,
    label: model.label,
    description: model.description,
    group: "realtime" as const,
    kind: "realtime" as const,
    tier: model.tier,
    minPlan: "free" as const,
    provider: "openai" as const,
  }));
}

function toChatOption(model: (typeof AI_MODELS)[number]): AssistantModelOption {
  return {
    id: model.id,
    label: model.label,
    group: model.category,
    kind: "chat",
    category: model.category,
    minPlan: model.minPlan,
    provider: model.provider,
  };
}

export function getVoiceAssistantModels(
  plan?: string,
  currentModelId?: string
): AssistantModelOption[] {
  const realtimeOptions = toRealtimeOptions();
  const seen = new Set(realtimeOptions.map((model) => model.id));
  const planModels = getModelsForPlan(plan).map(toChatOption);

  const combined = [
    ...realtimeOptions,
    ...planModels.filter((model) => !seen.has(model.id)),
  ];

  if (currentModelId && !combined.some((model) => model.id === currentModelId)) {
    const realtime = getRealtimeModel(currentModelId);
    if (realtime) {
      combined.push({
        id: realtime.id,
        label: realtime.label,
        description: realtime.description,
        group: "realtime",
        kind: "realtime",
        tier: realtime.tier,
        minPlan: "free",
        provider: "openai",
      });
    } else {
      const chat = AI_MODELS.find((model) => model.id === currentModelId);
      if (chat) combined.push(toChatOption(chat));
    }
  }

  return combined;
}

export function groupAssistantModelsByGroup(
  models: AssistantModelOption[]
): Partial<Record<AssistantModelGroup, AssistantModelOption[]>> {
  const grouped: Partial<Record<AssistantModelGroup, AssistantModelOption[]>> = {
    realtime: models.filter((model) => model.group === "realtime"),
  };

  for (const category of AI_MODEL_CATEGORIES) {
    const items = models.filter((model) => model.group === category);
    if (items.length > 0) grouped[category] = items;
  }

  return grouped;
}

export function getAssistantModelLabel(modelId: string): string {
  return (
    getRealtimeModel(modelId)?.label ??
    AI_MODELS.find((model) => model.id === modelId)?.label ??
    modelId
  );
}

export function getAssistantModelOption(modelId: string): AssistantModelOption | undefined {
  const realtime = getRealtimeModel(modelId);
  if (realtime) {
    return {
      id: realtime.id,
      label: realtime.label,
      description: realtime.description,
      group: "realtime",
      kind: "realtime",
      tier: realtime.tier,
      minPlan: "free",
      provider: "openai",
    };
  }

  const chat = AI_MODELS.find((model) => model.id === modelId);
  if (!chat) return undefined;

  return toChatOption(chat);
}

export function formatAssistantModelSelectLabel(
  model: AssistantModelOption,
  t: (key: string) => string
): string {
  const tag = model.tier
    ? t(`voiceAgents.modelTier_${model.tier}`)
    : model.category
      ? t(`bots.modelCategory.${model.category}`)
      : model.group === "realtime"
        ? t("voiceAgents.modelGroup_realtime")
        : t(`bots.modelCategory.${model.group}`);
  return `${model.label} · ${tag}`;
}
