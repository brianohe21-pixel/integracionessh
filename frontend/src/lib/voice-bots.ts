import type { Bot } from "@/types";

export function getOutboundCallableBots(bots: Bot[]): Bot[] {
  return bots.filter((bot) => Boolean(bot.telephonyPhoneNumber?.trim()));
}

export function resolveOutboundBotId(
  bots: Bot[],
  preferredBotId?: string | null
): string {
  const callableBots = getOutboundCallableBots(bots);
  if (callableBots.length === 0) return "";

  if (preferredBotId && callableBots.some((bot) => bot.botId === preferredBotId)) {
    return preferredBotId;
  }

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("softphone-bot-id");
    if (stored && callableBots.some((bot) => bot.botId === stored)) {
      return stored;
    }
  }

  return callableBots[0]!.botId;
}
