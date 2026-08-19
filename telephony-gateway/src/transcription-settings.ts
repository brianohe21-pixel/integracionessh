import type { Bot } from "./types.js";

export const DEFAULT_VAD_THRESHOLD = 0.65;
export const DEFAULT_SILENCE_MS = 550;
export const DEFAULT_PREFIX_PADDING_MS = 400;

export type TelephonyTurnDetection = {
  type: "server_vad";
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  create_response: boolean;
  interrupt_response: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildTurnDetection(bot: Bot): TelephonyTurnDetection {
  return {
    type: "server_vad",
    threshold: clamp(bot.telephonyTranscriptionVadThreshold ?? DEFAULT_VAD_THRESHOLD, 0.3, 0.9),
    prefix_padding_ms: DEFAULT_PREFIX_PADDING_MS,
    silence_duration_ms: clamp(
      bot.telephonyTranscriptionSilenceMs ?? DEFAULT_SILENCE_MS,
      300,
      1200
    ),
    create_response: true,
    interrupt_response: Boolean(bot.telephonyTranscriptionBargeIn),
  };
}

export function isBargeInEnabled(bot: Bot): boolean {
  return Boolean(bot.telephonyTranscriptionBargeIn);
}
