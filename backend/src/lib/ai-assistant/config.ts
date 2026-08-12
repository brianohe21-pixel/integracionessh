import type { AiAssistantConfig, Bot } from "../../types/index.js";

export function isAiAssistantEnabled(bot: Bot): boolean {
  return bot.responseMode === "openai";
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
