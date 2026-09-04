import { getBotByWabaId } from "../../dynamodb/bot-lookup.repository.js";
import { getBot, updateBot } from "../../dynamodb/bot.repository.js";
import {
  handleAccountUpdateEnforcement,
} from "../enforcement.js";
import type { WhatsAppAccountUpdateValue } from "../../../types/index.js";

export async function handleAccountUpdate(params: {
  wabaId: string;
  value: WhatsAppAccountUpdateValue;
}): Promise<void> {
  await handleAccountUpdateEnforcement(params);

  const lookup = await getBotByWabaId(params.wabaId);
  if (!lookup) return;

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot) return;

  const event = params.value.event;
  if (event === "PARTNER_REMOVED") {
    await updateBot(lookup.tenantId, lookup.botId, {
      whatsappDisconnectedAt: new Date().toISOString(),
      whatsappDisconnectionReason:
        params.value.disconnection_info?.reason ?? "PARTNER_REMOVED",
      status: "inactive",
    });
    return;
  }

  if (event === "ACCOUNT_RECONNECTED") {
    await updateBot(lookup.tenantId, lookup.botId, {
      status: "active",
    });
  }
}
