import type { AiChatProvider } from "../types.js";

export class AnthropicProvider implements AiChatProvider {
  readonly provider = "anthropic" as const;

  generateChatResponse(): Promise<never> {
    return Promise.reject(new Error("Provider not yet supported"));
  }

  generateEmbedding(): Promise<never> {
    return Promise.reject(new Error("Provider not yet supported"));
  }

  completeJson(): Promise<never> {
    return Promise.reject(new Error("Provider not yet supported"));
  }
}
