import type { Bot, OutreachChannel } from "@/types";

export function listOutreachAgents(bots: Bot[], channel: OutreachChannel): Bot[] {
  return bots.filter((bot) => {
    if (bot.status === "inactive") return false;
    if (channel === "sms") {
      return Boolean(bot.smsEnabled && bot.smsOriginationNumber?.trim());
    }
    return Boolean(bot.phoneNumberId?.trim());
  });
}
