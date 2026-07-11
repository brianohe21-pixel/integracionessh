import { listBots } from "../dynamodb/bot.repository.js";
import { listCalendarConfigs } from "../dynamodb/calendar-config.repository.js";
import { listPaymentsConfigs } from "../dynamodb/payments-config.repository.js";
import { listCatalogConfigs } from "../dynamodb/catalog-config.repository.js";

export async function listAppsCatalog(tenantId: string) {
  const bots = await listBots(tenantId);
  const calendarConfigs = await listCalendarConfigs(tenantId);
  const paymentsConfigs = await listPaymentsConfigs(tenantId);
  const catalogConfigs = await listCatalogConfigs(tenantId);
  const calendarByBot = new Map(calendarConfigs.map((c) => [c.botId, c]));
  const paymentsByBot = new Map(paymentsConfigs.map((c) => [c.botId, c]));
  const catalogByBot = new Map(catalogConfigs.map((c) => [c.botId, c]));

  const installedBots = bots.map((bot) => ({
    botId: bot.botId,
    botName: bot.name,
  }));

  return {
    apps: [
      {
        id: "calendar",
        name: "Calendar",
        description: "Schedule appointments and manage bookings per bot",
        installedBots: installedBots.map((bot) => ({
          ...bot,
          enabled: calendarByBot.get(bot.botId)?.enabled ?? false,
        })),
      },
      {
        id: "payments",
        name: "Payments",
        description: "Collect payments from customers via Wompi per bot",
        installedBots: installedBots.map((bot) => ({
          ...bot,
          enabled: paymentsByBot.get(bot.botId)?.enabled ?? false,
        })),
      },
      {
        id: "catalog",
        name: "Catalog",
        description: "Product catalog and WhatsApp Commerce orders per bot",
        installedBots: installedBots.map((bot) => ({
          ...bot,
          enabled: catalogByBot.get(bot.botId)?.enabled ?? false,
        })),
      },
    ],
  };
}
