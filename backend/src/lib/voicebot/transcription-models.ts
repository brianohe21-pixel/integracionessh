export type SttProviderId = "openai" | "deepgram";

export interface TranscriptionModelDefinition {
  id: string;
  provider: SttProviderId;
  providerLabel: string;
  label: string;
  description: string;
}

export const DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID = "gpt-4o-mini-transcribe";
export const DEFAULT_VOICEBOT_TRANSCRIPTION_MODEL_ID = "whisper-1";

export const TELEPHONY_TRANSCRIPTION_MODELS: TranscriptionModelDefinition[] = [
  {
    id: "gpt-4o-mini-transcribe",
    provider: "openai",
    providerLabel: "OpenAI",
    label: "GPT-4o Mini Transcribe",
    description: "Fast and cost-efficient speech-to-text for realtime sessions",
  },
  {
    id: "gpt-4o-transcribe",
    provider: "openai",
    providerLabel: "OpenAI",
    label: "GPT-4o Transcribe",
    description: "Higher accuracy speech-to-text for realtime sessions",
  },
  {
    id: "whisper-1",
    provider: "openai",
    providerLabel: "OpenAI",
    label: "Whisper",
    description: "Classic OpenAI speech recognition model",
  },
  {
    id: "deepgram:nova-3",
    provider: "deepgram",
    providerLabel: "Deepgram",
    label: "Nova-3",
    description: "High-accuracy streaming transcription optimized for phone audio",
  },
];

export const VOICEBOT_TRANSCRIPTION_MODELS: TranscriptionModelDefinition[] = [
  {
    id: "gpt-4o-mini-transcribe",
    provider: "openai",
    providerLabel: "OpenAI",
    label: "GPT-4o Mini Transcribe",
    description: "Fast and cost-efficient speech-to-text for realtime sessions",
  },
  {
    id: "gpt-4o-transcribe",
    provider: "openai",
    providerLabel: "OpenAI",
    label: "GPT-4o Transcribe",
    description: "Higher accuracy speech-to-text for realtime sessions",
  },
  {
    id: "whisper-1",
    provider: "openai",
    providerLabel: "OpenAI",
    label: "Whisper",
    description: "Classic OpenAI speech recognition model",
  },
];

export const TRANSCRIPTION_MODELS = TELEPHONY_TRANSCRIPTION_MODELS;

const TELEPHONY_MODEL_IDS = new Set(TELEPHONY_TRANSCRIPTION_MODELS.map((model) => model.id));
const VOICEBOT_MODEL_IDS = new Set(VOICEBOT_TRANSCRIPTION_MODELS.map((model) => model.id));

export function isValidTelephonyTranscriptionModelId(modelId: string): boolean {
  return TELEPHONY_MODEL_IDS.has(modelId);
}

export function isValidVoicebotTranscriptionModelId(modelId: string): boolean {
  return VOICEBOT_MODEL_IDS.has(modelId);
}

export function isValidTranscriptionModelId(modelId: string): boolean {
  return isValidTelephonyTranscriptionModelId(modelId);
}

export function resolveTranscriptionModelId(
  modelId: string | undefined,
  allowedIds: Set<string>,
  defaultId: string
): string {
  if (modelId && allowedIds.has(modelId)) return modelId;
  return defaultId;
}

export function resolveTelephonyTranscriptionModelId(modelId?: string): string {
  return resolveTranscriptionModelId(
    modelId,
    TELEPHONY_MODEL_IDS,
    DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID
  );
}

export function resolveVoicebotTranscriptionModelId(modelId?: string): string {
  return resolveTranscriptionModelId(
    modelId,
    VOICEBOT_MODEL_IDS,
    DEFAULT_VOICEBOT_TRANSCRIPTION_MODEL_ID
  );
}
