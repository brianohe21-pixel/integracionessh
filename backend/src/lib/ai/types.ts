import type { Bot, BotLocale, Message } from "../../types/index.js";
import type { AiProvider } from "./models.js";

export type { AiProvider } from "./models.js";

export interface ChatCompletionResult {
  reply: string | null;
  handoff: boolean;
  handoffReason?: string;
}

export interface ChatCalendarContext {
  contactPhone: string;
  conversationId: string;
}

export interface ChatCompletionParams {
  bot: Bot;
  conversationHistory: Message[];
  userMessage: string;
  apiKey: string;
  tenantId?: string;
  calendarContext?: ChatCalendarContext;
  locale?: BotLocale;
}

export interface JsonCompletionParams {
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatProvider {
  readonly provider: AiProvider;
  generateChatResponse(params: ChatCompletionParams): Promise<ChatCompletionResult>;
  generateEmbedding(text: string, apiKey: string): Promise<number[]>;
  completeJson<T>(params: JsonCompletionParams): Promise<T>;
}
