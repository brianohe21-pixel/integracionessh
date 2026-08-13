import type { AiAssistantConfig, Bot } from "../../types/index.js";
import { DEFAULT_MODEL_ID } from "../ai/models.js";

const DEFAULT_AI_ASSISTANT_PROMPT =
  "You are a helpful virtual assistant. Reply clearly and professionally.";

export function isAiAssistantEnabled(bot: Bot): boolean {
  return bot.responseMode === "openai";
}

export function buildAiAssistantAutoEnableUpdates(
  bot: Bot
): Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">> {
  if (isAiAssistantEnabled(bot)) return {};

  const systemPrompt =
    bot.telephonySystemPrompt?.trim() ||
    bot.voicebotSystemPrompt?.trim() ||
    bot.systemPrompt?.trim() ||
    DEFAULT_AI_ASSISTANT_PROMPT;

  return {
    responseMode: "openai",
    systemPrompt,
    model: bot.model ?? DEFAULT_MODEL_ID,
    temperature: bot.temperature ?? 0.7,
    maxTokens: bot.maxTokens ?? 1024,
    ...(bot.aiProvider ? { aiProvider: bot.aiProvider } : {}),
  };
}

export function toAiAssistantConfig(bot: Bot): AiAssistantConfig {
  const config: AiAssistantConfig = {
    enabled: isAiAssistantEnabled(bot),
  };
  if (bot.systemPrompt !== undefined) config.systemPrompt = bot.systemPrompt;
  if (bot.aiProvider !== undefined) config.aiProvider = bot.aiProvider;
  if (bot.model !== undefined) config.model = bot.model;
  if (bot.temperature !== undefined) config.temperature = bot.temperature;
  if (bot.maxTokens !== undefined) config.maxTokens = bot.maxTokens;
  if (bot.knowledgeEnabled !== undefined) config.knowledgeEnabled = bot.knowledgeEnabled;
  return config;
}

export function assertCanDisableAiAssistant(bot: Bot): void {
  if (bot.voicebotEnabled) {
    throw Object.assign(new Error("Disable voicebot before turning off AI Assistant"), {
      statusCode: 400,
    });
  }
  if (bot.telephonyEnabled) {
    throw Object.assign(new Error("Disable telephony before turning off AI Assistant"), {
      statusCode: 400,
    });
  }
}

export function assertAiAssistantActive(bot: Bot): void {
  if (!isAiAssistantEnabled(bot)) {
    throw Object.assign(new Error("AI Assistant is not enabled for this agent"), {
      statusCode: 400,
    });
  }
}

export function assertKnowledgeManagementAllowed(bot: Bot): void {
  if (
    isAiAssistantEnabled(bot) ||
    bot.telephonyEnabled ||
    bot.voicebotEnabled ||
    Boolean(bot.telephonyPhoneNumber?.trim())
  ) {
    return;
  }
  assertAiAssistantActive(bot);
}
