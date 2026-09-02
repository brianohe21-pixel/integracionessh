import type { ResolvedSttModel, SttModelDefinition, SttProviderId } from "./types.js";

export const DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID = "gpt-4o-mini-transcribe";

export const TELEPHONY_STT_MODELS: SttModelDefinition[] = [
  {
    id: "gpt-4o-mini-transcribe",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "gpt-4o-mini-transcribe",
    label: "GPT-4o Mini Transcribe",
    description: "Fast and cost-efficient speech-to-text for realtime sessions",
  },
  {
    id: "gpt-4o-transcribe",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    description: "Higher accuracy speech-to-text for realtime sessions",
  },
  {
    id: "whisper-1",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "whisper-1",
    label: "Whisper",
    description: "Classic OpenAI speech recognition model",
  },
  {
    id: "deepgram:nova-3",
    provider: "deepgram",
    providerLabel: "Deepgram",
    model: "nova-3",
    label: "Nova-3",
    description: "High-accuracy streaming transcription optimized for phone audio",
  },
];

const MODEL_BY_ID = new Map(TELEPHONY_STT_MODELS.map((entry) => [entry.id, entry]));

export function parseSttModelId(modelId: string): { provider: SttProviderId; model: string } {
  const colonIndex = modelId.indexOf(":");
  if (colonIndex > 0) {
    const provider = modelId.slice(0, colonIndex) as SttProviderId;
    return { provider, model: modelId.slice(colonIndex + 1) };
  }
  return { provider: "openai", model: modelId };
}

export function isValidTelephonySttModelId(modelId: string): boolean {
  return MODEL_BY_ID.has(modelId);
}

export function resolveTelephonySttModel(modelId?: string): ResolvedSttModel {
  const resolvedId =
    modelId && isValidTelephonySttModelId(modelId)
      ? modelId
      : DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID;
  const definition = MODEL_BY_ID.get(resolvedId)!;
  return {
    id: definition.id,
    provider: definition.provider,
    model: definition.model,
    usesOpenAiNativeTranscription: definition.provider === "openai",
  };
}

export function resolveOpenAiTranscriptionModelId(modelId?: string): string {
  const resolved = resolveTelephonySttModel(modelId);
  if (!resolved.usesOpenAiNativeTranscription) {
    return DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID;
  }
  return resolved.model;
}
