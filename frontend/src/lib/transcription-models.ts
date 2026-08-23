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

export const TRANSCRIPTION_MODELS: TranscriptionModelDefinition[] = [
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

export function getTranscriptionModelLabel(modelId: string): string {
  return TRANSCRIPTION_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}

export function getTranscriptionModel(modelId: string): TranscriptionModelDefinition | undefined {
  return TRANSCRIPTION_MODELS.find((model) => model.id === modelId);
}
