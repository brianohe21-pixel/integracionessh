export {
  DEFAULT_TELEPHONY_TRANSCRIPTION_MODEL_ID,
  resolveOpenAiTranscriptionModelId,
  resolveTelephonySttModel,
  isValidTelephonySttModelId,
  TELEPHONY_STT_MODELS,
} from "./stt/registry.js";

import { resolveOpenAiTranscriptionModelId } from "./stt/registry.js";

export function resolveTelephonyTranscriptionModelId(modelId?: string): string {
  return resolveOpenAiTranscriptionModelId(modelId);
}
