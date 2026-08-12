import type { TelephonyStructuredOutputDefinition } from "../../types/index.js";

export interface PublicVoiceStructuredOutputResponse {
  botId: string;
  structuredOutput: TelephonyStructuredOutputDefinition | null;
}

export function toPublicVoiceStructuredOutputResponse(
  botId: string,
  structuredOutput: TelephonyStructuredOutputDefinition | null
): PublicVoiceStructuredOutputResponse {
  return {
    botId,
    structuredOutput,
  };
}
