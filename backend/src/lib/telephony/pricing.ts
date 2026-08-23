export const TELEPHONY_PRICING_VERSION = "2026-08-21";

export const TELEPHONY_PLATFORM_PER_MINUTE_USD = 0.022;

export const ELEVENLABS_TTS_PER_1K_CHARACTERS_USD = {
  eleven_flash_v2_5: 0.05,
  eleven_turbo_v2_5: 0.05,
  eleven_multilingual_v2: 0.1,
} as const;

export const TELEPHONY_RATES = {
  platformPerMinuteUsd: TELEPHONY_PLATFORM_PER_MINUTE_USD,
  telnyxOutboundPerMinuteUsd: 0.005,
  telnyxInboundPerMinuteUsd: 0.0035,
  telnyxRecordingPerMinuteUsd: 0.002,
  openaiInputPer1kTokensUsd: 0.0004,
  openaiOutputPer1kTokensUsd: 0.0016,
  elevenlabsPerCharacterUsd:
    ELEVENLABS_TTS_PER_1K_CHARACTERS_USD.eleven_flash_v2_5 / 1000,
} as const;

export const DEEPGRAM_STT_PER_MINUTE_USD = {
  "nova-3": 0.0048,
  "deepgram:nova-3": 0.0048,
} as const;

export function getDeepgramPerMinuteUsd(modelId?: string): number {
  const key = modelId as keyof typeof DEEPGRAM_STT_PER_MINUTE_USD;
  return DEEPGRAM_STT_PER_MINUTE_USD[key] ?? DEEPGRAM_STT_PER_MINUTE_USD["nova-3"];
}

export function getElevenLabsPerCharacterUsd(modelId?: string): number {
  const per1kCharacters =
    ELEVENLABS_TTS_PER_1K_CHARACTERS_USD[
      modelId as keyof typeof ELEVENLABS_TTS_PER_1K_CHARACTERS_USD
    ] ?? ELEVENLABS_TTS_PER_1K_CHARACTERS_USD.eleven_flash_v2_5;

  return per1kCharacters / 1000;
}
