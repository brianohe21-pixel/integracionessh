export const DEFAULT_TTS_MODEL_ID = "eleven_flash_v2_5";

const TTS_MODEL_IDS = new Set([
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_multilingual_v2",
]);

export function resolveTtsModelId(modelId?: string): string {
  const trimmed = modelId?.trim();
  if (trimmed && TTS_MODEL_IDS.has(trimmed)) return trimmed;
  return DEFAULT_TTS_MODEL_ID;
}
