export type RealtimeModelTier = "economy" | "balanced" | "flagship" | "legacy";

export interface RealtimeModelDefinition {
  id: string;
  label: string;
  tier: RealtimeModelTier;
}

export const DEFAULT_REALTIME_MODEL_ID = "gpt-realtime-2.1-mini";

export const REALTIME_MODELS: RealtimeModelDefinition[] = [
  {
    id: "gpt-realtime-2.1-mini",
    label: "GPT-Realtime 2.1 Mini",
    tier: "economy",
  },
  {
    id: "gpt-realtime-2.1",
    label: "GPT-Realtime 2.1",
    tier: "flagship",
  },
  {
    id: "gpt-realtime-2",
    label: "GPT-Realtime 2",
    tier: "balanced",
  },
  {
    id: "gpt-realtime-1.5",
    label: "GPT-Realtime 1.5",
    tier: "legacy",
  },
  {
    id: "gpt-realtime",
    label: "GPT-Realtime",
    tier: "legacy",
  },
  {
    id: "gpt-realtime-mini",
    label: "GPT-Realtime Mini",
    tier: "legacy",
  },
];

export function getRealtimeModelLabel(modelId: string): string {
  return REALTIME_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}
