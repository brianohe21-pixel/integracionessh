export const DEFAULT_TTS_MODEL_ID = "eleven_flash_v2_5";

const TTS_MODEL_IDS = new Set([
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_multilingual_v2",
]);

export function isValidTtsModelId(modelId: string): boolean {
  return TTS_MODEL_IDS.has(modelId);
}
