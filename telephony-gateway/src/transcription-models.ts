export const DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID = "gpt-4o-mini-transcribe";

const TRANSCRIPTION_MODEL_IDS = new Set([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
]);

export function resolveTelephonyTranscriptionModelId(modelId?: string): string {
  if (modelId && TRANSCRIPTION_MODEL_IDS.has(modelId)) return modelId;
  return DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID;
}
