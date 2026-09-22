import type { Bot } from "@/types";

export type AiAssistantDisableBlocker = "voicebot" | "telephony";

type BotChannelFlags = Pick<Bot, "voicebotEnabled" | "telephonyEnabled">;

export function getAiAssistantDisableBlockers(bot: BotChannelFlags): AiAssistantDisableBlocker[] {
  const blockers: AiAssistantDisableBlocker[] = [];
  if (bot.voicebotEnabled) blockers.push("voicebot");
  if (bot.telephonyEnabled) blockers.push("telephony");
  return blockers;
}

export function canDisableAiAssistant(bot: BotChannelFlags): boolean {
  return getAiAssistantDisableBlockers(bot).length === 0;
}
