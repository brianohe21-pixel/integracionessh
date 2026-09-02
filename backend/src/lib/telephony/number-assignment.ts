import { getBot, listBots, updateBot } from "../dynamodb/bot.repository.js";
import {
  deleteTelephonyNumberLookup,
  getBotByTelephonyNumber,
} from "../dynamodb/bot-lookup.repository.js";
import { normalizeE164 } from "../telnyx/phone.js";
import type { Bot } from "../../types/index.js";

type BotUpdates = Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">>;

export async function clearStaleTelephonyNumberLookup(
  tenantId: string,
  phoneNumber: string
): Promise<boolean> {
  const normalized = normalizeE164(phoneNumber);
  if (!normalized) return false;

  const lookup = await getBotByTelephonyNumber(normalized);
  if (!lookup || lookup.tenantId !== tenantId) return false;

  const tenantBots = await listBots(tenantId);
  const botExists = tenantBots.some((bot) => bot.botId === lookup.botId);
  if (botExists) return false;

  await deleteTelephonyNumberLookup(normalized);
  return true;
}

export async function releaseTelephonyNumberFromBot(
  tenantId: string,
  botId: string,
  phoneNumber: string
): Promise<void> {
  const normalized = normalizeE164(phoneNumber);
  await deleteTelephonyNumberLookup(normalized);

  const existing = await getBot(tenantId, botId);
  if (!existing) return;

  const updates = {
    telephonyPhoneNumber: undefined,
    telephonyEnabled: false,
  } as unknown as BotUpdates;
  await updateBot(tenantId, botId, updates);
}

export async function reassignTelephonyNumber(params: {
  tenantId: string;
  targetBotId: string;
  phoneNumber: string;
}): Promise<void> {
  const normalized = normalizeE164(params.phoneNumber);
  if (!normalized) return;

  await clearStaleTelephonyNumberLookup(params.tenantId, normalized);

  const lookup = await getBotByTelephonyNumber(normalized);
  if (
    lookup &&
    lookup.tenantId === params.tenantId &&
    lookup.botId !== params.targetBotId
  ) {
    await releaseTelephonyNumberFromBot(params.tenantId, lookup.botId, normalized);
  }

  const tenantBots = await listBots(params.tenantId);
  for (const bot of tenantBots) {
    if (
      bot.botId !== params.targetBotId &&
      bot.telephonyPhoneNumber &&
      normalizeE164(bot.telephonyPhoneNumber) === normalized
    ) {
      await releaseTelephonyNumberFromBot(params.tenantId, bot.botId, normalized);
    }
  }
}
