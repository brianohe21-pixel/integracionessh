import { resolveBotProvider, resolveModelId } from "./models.js";
import { getChatProvider } from "./providers/index.js";
import type { ChatCalendarContext, ChatCompletionParams, ChatCompletionResult } from "./types.js";
import type { Bot, BotLocale, Message } from "../../types/index.js";

export type { ChatCalendarContext, ChatCompletionResult } from "./types.js";

export async function generateChatResponse(
  bot: Bot,
  conversationHistory: Message[],
  userMessage: string,
  apiKey: string,
  tenantId?: string,
  calendarContext?: ChatCalendarContext,
  locale: BotLocale = "es"
): Promise<ChatCompletionResult> {
  const provider = getChatProvider(resolveBotProvider(bot.model, bot.aiProvider));
  const params: ChatCompletionParams = {
    bot: { ...bot, model: resolveModelId(bot.model) },
    conversationHistory,
    userMessage,
    apiKey,
    ...(tenantId ? { tenantId } : {}),
    ...(calendarContext ? { calendarContext } : {}),
    locale,
  };
  return provider.generateChatResponse(params);
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  return getChatProvider("openai").generateEmbedding(text, apiKey);
}
