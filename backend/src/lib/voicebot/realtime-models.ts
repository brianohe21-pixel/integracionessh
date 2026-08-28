import { isValidModelId } from "../ai/models.js";

export type RealtimeModelTier = "economy" | "balanced" | "flagship" | "legacy";

export interface RealtimeModelDefinition {
  id: string;
  label: string;
  tier: RealtimeModelTier;
  description: string;
}

export const DEFAULT_REALTIME_MODEL_ID = "gpt-realtime-2.1-mini";

export const REALTIME_MODELS: RealtimeModelDefinition[] = [
  {
    id: "gpt-realtime-2.1-mini",
    label: "GPT-Realtime 2.1 Mini",
    tier: "economy",
    description: "Fast and cost-efficient voice model with reasoning",
  },
  {
    id: "gpt-realtime-2.1",
    label: "GPT-Realtime 2.1",
    tier: "flagship",
    description: "Best realtime voice quality with improved recognition and interruptions",
  },
  {
    id: "gpt-realtime-2",
    label: "GPT-Realtime 2",
    tier: "balanced",
    description: "Configurable reasoning effort for speech-to-speech agents",
  },
  {
    id: "gpt-realtime-1.5",
    label: "GPT-Realtime 1.5",
    tier: "legacy",
    description: "Optimized classic voice model for audio in and out",
  },
  {
    id: "gpt-realtime",
    label: "GPT-Realtime",
    tier: "legacy",
    description: "Original realtime speech model for audio and text over live connections",
  },
  {
    id: "gpt-realtime-mini",
    label: "GPT-Realtime Mini",
    tier: "legacy",
    description: "Cost-efficient legacy realtime speech model",
  },
];

const REALTIME_MODEL_IDS = new Set(REALTIME_MODELS.map((model) => model.id));

export function isValidRealtimeModelId(modelId: string): boolean {
  return REALTIME_MODEL_IDS.has(modelId) || modelId.startsWith("gpt-realtime");
}

export function isValidTelephonyAssistantModelId(modelId: string): boolean {
  return isValidRealtimeModelId(modelId) || isValidModelId(modelId);
}

export function resolveRealtimeModelId(modelId?: string): string {
  if (modelId && isValidTelephonyAssistantModelId(modelId)) return modelId;
  return DEFAULT_REALTIME_MODEL_ID;
}

export function getRealtimeModelLabel(modelId: string): string {
  return REALTIME_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}
