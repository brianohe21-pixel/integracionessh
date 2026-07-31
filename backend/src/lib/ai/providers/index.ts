import type { AiProvider } from "../models.js";
import type { AiChatProvider } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { getOpenAIApiKey, openAIProvider } from "./openai.js";

const anthropicProvider = new AnthropicProvider();

export function getChatProvider(provider: AiProvider): AiChatProvider {
  if (provider === "openai") return openAIProvider;
  if (provider === "anthropic") return anthropicProvider;
  throw new Error(`Unknown AI provider: ${provider}`);
}

export async function resolveApiKey(
  tenantId: string,
  provider: AiProvider,
  environment: string
): Promise<string> {
  if (provider === "openai") {
    return getOpenAIApiKey(tenantId, environment);
  }

  // Future: /{environment}/tenants/{tenantId}/anthropic
  throw new Error(`No API key resolver configured for provider: ${provider}`);
}

export { getOpenAIApiKey, openAIProvider } from "./openai.js";
