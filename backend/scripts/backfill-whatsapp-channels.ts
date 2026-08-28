import { listBots } from "../src/lib/dynamodb/bot.repository.js";
import {
  getWhatsAppSecrets,
  saveWhatsAppAccountSecret,
} from "../src/lib/whatsapp/secrets.js";
import { upsertWhatsAppAccount } from "../src/lib/dynamodb/whatsapp-account.repository.js";
import {
  createWhatsAppChannel,
  listWhatsAppChannels,
} from "../src/lib/dynamodb/whatsapp-channel.repository.js";
import { randomUUID } from "crypto";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const TENANT_ID = process.env.TENANT_ID;

async function main() {
  if (!TENANT_ID) {
    throw new Error("TENANT_ID is required");
  }

  const bots = await listBots(TENANT_ID);
  let tenantSecret: { accessToken: string; appSecret: string } | null = null;
  try {
    tenantSecret = await getWhatsAppSecrets(TENANT_ID, ENVIRONMENT);
  } catch {
    tenantSecret = null;
  }

  for (const bot of bots) {
    if (!bot.phoneNumberId?.trim() || !bot.whatsappBusinessAccountId?.trim()) {
      continue;
    }

    const existingChannels = await listWhatsAppChannels(TENANT_ID, bot.botId);
    if (existingChannels.some((c) => c.phoneNumberId === bot.phoneNumberId)) {
      continue;
    }

    const accountId = randomUUID();
    if (tenantSecret) {
      await saveWhatsAppAccountSecret(TENANT_ID, accountId, ENVIRONMENT, tenantSecret);
    }

    await upsertWhatsAppAccount({
      accountId,
      tenantId: TENANT_ID,
      wabaId: bot.whatsappBusinessAccountId,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await createWhatsAppChannel({
      tenantId: TENANT_ID,
      botId: bot.botId,
      accountId,
      phoneNumberId: bot.phoneNumberId,
      whatsappBusinessAccountId: bot.whatsappBusinessAccountId,
      status: "active",
      isDefault: existingChannels.length === 0,
      ...(bot.whatsappOnboardingMode
        ? { whatsappOnboardingMode: bot.whatsappOnboardingMode }
        : {}),
      ...(bot.isOnBizApp !== undefined ? { isOnBizApp: bot.isOnBizApp } : {}),
      ...(bot.platformType ? { platformType: bot.platformType } : {}),
    });

    console.log(`Backfilled channel for bot ${bot.botId} phone ${bot.phoneNumberId}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
