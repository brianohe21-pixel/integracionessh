import type { Bot } from "./types.js";
import { resolveTtsModelId } from "./tts-models.js";

export const DEFAULT_VOICE_SPEED = 1;
export const DEFAULT_VOICE_STABILITY = 0.5;
export const DEFAULT_VOICE_SIMILARITY = 0.75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveVoiceSettings(bot: Bot): {
  stability: number;
  similarity_boost: number;
  speed: number;
} {
  return {
    stability: clamp(bot.telephonyVoiceStability ?? DEFAULT_VOICE_STABILITY, 0, 1),
    similarity_boost: clamp(bot.telephonyVoiceSimilarity ?? DEFAULT_VOICE_SIMILARITY, 0, 1),
    speed: clamp(bot.telephonyVoiceSpeed ?? DEFAULT_VOICE_SPEED, 0.7, 1.2),
  };
}

export function resolveTtsModel(bot: Bot): string {
  return resolveTtsModelId(bot.telephonyTtsModel);
}
