export interface TtsModelDefinition {
  id: string;
  label: string;
  description: string;
}

export const DEFAULT_TTS_MODEL_ID = "eleven_flash_v2_5";

export const TTS_MODELS: TtsModelDefinition[] = [
  {
    id: "eleven_flash_v2_5",
    label: "Eleven Flash v2.5",
    description: "Low latency, optimized for realtime phone calls",
  },
  {
    id: "eleven_turbo_v2_5",
    label: "Eleven Turbo v2.5",
    description: "Fast generation with good quality",
  },
  {
    id: "eleven_multilingual_v2",
    label: "Eleven Multilingual v2",
    description: "Strong multilingual voice synthesis",
  },
];

export const DEFAULT_VOICE_SPEED = 1;
export const DEFAULT_VOICE_STABILITY = 0.5;
export const DEFAULT_VOICE_SIMILARITY = 0.75;

export function getTtsModelLabel(modelId: string): string {
  return TTS_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}
