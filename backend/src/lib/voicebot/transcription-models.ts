export interface TranscriptionModelDefinition {
  id: string;
  label: string;
  description: string;
}

export const DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID = "gpt-4o-mini-transcribe";
export const DEFAULT_VOICEBOT_TRANSCRIPTION_MODEL_ID = "whisper-1";

export const TRANSCRIPTION_MODELS: TranscriptionModelDefinition[] = [
  {
    id: "gpt-4o-mini-transcribe",
    label: "GPT-4o Mini Transcribe",
    description: "Fast and cost-efficient speech-to-text for realtime sessions",
  },
  {
    id: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    description: "Higher accuracy speech-to-text for realtime sessions",
  },
  {
    id: "whisper-1",
    label: "Whisper",
    description: "Classic OpenAI speech recognition model",
  },
];

const TRANSCRIPTION_MODEL_IDS = new Set(TRANSCRIPTION_MODELS.map((model) => model.id));

export function isValidTranscriptionModelId(modelId: string): boolean {
  return TRANSCRIPTION_MODEL_IDS.has(modelId);
}

export function resolveTranscriptionModelId(
  modelId?: string,
  defaultId = DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID
): string {
  if (modelId && isValidTranscriptionModelId(modelId)) return modelId;
  return defaultId;
}

export function resolveTelephonyTranscriptionModelId(modelId?: string): string {
  return resolveTranscriptionModelId(modelId, DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID);
}

export function resolveVoicebotTranscriptionModelId(modelId?: string): string {
  return resolveTranscriptionModelId(modelId, DEFAULT_VOICEBOT_TRANSCRIPTION_MODEL_ID);
}
