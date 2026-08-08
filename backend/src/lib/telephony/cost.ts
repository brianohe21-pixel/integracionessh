import type {
  CallCostBreakdown,
  CallCostStatus,
  CallRecord,
  CallUsageMetrics,
  TelephonyCallDirection,
} from "../../types/index.js";
import { TELEPHONY_PRICING_VERSION, TELEPHONY_RATES } from "./pricing.js";

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function estimateTelephonyCost(params: {
  direction: TelephonyCallDirection;
  durationSeconds: number;
  usage?: CallUsageMetrics;
  recordingEnabled?: boolean;
  telnyxCostUsd?: number;
}): { breakdown: CallCostBreakdown; status: CallCostStatus } {
  const minutes = Math.max(params.durationSeconds, 1) / 60;
  const telnyxRate =
    params.direction === "inbound"
      ? TELEPHONY_RATES.telnyxInboundPerMinuteUsd
      : TELEPHONY_RATES.telnyxOutboundPerMinuteUsd;

  const telnyxUsd =
    params.telnyxCostUsd ?? roundUsd(minutes * telnyxRate);
  const platformUsd = roundUsd(minutes * TELEPHONY_RATES.platformPerMinuteUsd);

  const openaiInputTokens = params.usage?.openaiInputTokens ?? 0;
  const openaiOutputTokens = params.usage?.openaiOutputTokens ?? 0;
  const elevenlabsCharacters = params.usage?.elevenlabsCharacters ?? 0;

  const openaiUsd = roundUsd(
    (openaiInputTokens / 1000) * TELEPHONY_RATES.openaiInputPer1kTokensUsd +
      (openaiOutputTokens / 1000) * TELEPHONY_RATES.openaiOutputPer1kTokensUsd
  );
  const elevenlabsUsd = roundUsd(
    elevenlabsCharacters * TELEPHONY_RATES.elevenlabsPerCharacterUsd
  );
  const recordingUsd = params.recordingEnabled
    ? roundUsd(minutes * TELEPHONY_RATES.telnyxRecordingPerMinuteUsd)
    : 0;

  const totalUsd = roundUsd(telnyxUsd + platformUsd + openaiUsd + elevenlabsUsd + recordingUsd);
  const hasUsage = openaiInputTokens > 0 || openaiOutputTokens > 0 || elevenlabsCharacters > 0;
  const status: CallCostStatus =
    params.telnyxCostUsd !== undefined && hasUsage
      ? "final"
      : params.telnyxCostUsd !== undefined || hasUsage
        ? "partial"
        : "pending";

  return {
    breakdown: {
      telnyxUsd,
      platformUsd,
      openaiUsd,
      elevenlabsUsd,
      recordingUsd,
      totalUsd,
      currency: "USD",
      pricingVersion: TELEPHONY_PRICING_VERSION,
    },
    status,
  };
}

export function directionFromCallRecord(call: CallRecord): TelephonyCallDirection {
  return call.direction === "USER_INITIATED" ? "inbound" : "outbound";
}
