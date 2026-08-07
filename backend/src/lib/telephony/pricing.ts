export const TELEPHONY_PRICING_VERSION = "2026-03-01";

export const TELEPHONY_RATES = {
  telnyxPlatformPerMinuteUsd: 0.002,
  telnyxOutboundPerMinuteUsd: 0.005,
  telnyxInboundPerMinuteUsd: 0.0035,
  telnyxRecordingPerMinuteUsd: 0.002,
  openaiInputPer1kTokensUsd: 0.0004,
  openaiOutputPer1kTokensUsd: 0.0016,
  elevenlabsPerCharacterUsd: 0.000003,
} as const;
