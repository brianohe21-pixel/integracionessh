import { getBotByWabaId } from "../../dynamodb/bot-lookup.repository.js";
import { getBot, updateBot } from "../../dynamodb/bot.repository.js";
import {
  handleAccountUpdateEnforcement,
} from "../enforcement.js";
import { emitOpsAlertSafe } from "../../ops-alerts/emit.js";
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
    emitOpsAlertSafe({
      tenantId: lookup.tenantId,
      ruleId: "channel_down",
      title: "WhatsApp channel disconnected",
      body: `Bot ${bot.name} lost WhatsApp coexistence (${params.value.disconnection_info?.reason ?? "PARTNER_REMOVED"}).`,
      href: `/bots/${lookup.botId}`,
      severity: "critical",
      dedupeKey: `channel_down:bot:${lookup.botId}:partner_removed`,
    });
    return;
  }

  if (event === "ACCOUNT_RECONNECTED") {
    await updateBot(lookup.tenantId, lookup.botId, {
      status: "active",
    });
  }
}
