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

export function getTranscriptionModelLabel(modelId: string): string {
  return TRANSCRIPTION_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}

export function getTranscriptionModel(modelId: string): TranscriptionModelDefinition | undefined {
  return TRANSCRIPTION_MODELS.find((model) => model.id === modelId);
}
