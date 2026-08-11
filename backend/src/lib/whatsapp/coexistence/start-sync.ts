import { requestSmbAppData } from "../client.js";
import { getWhatsAppAccessToken } from "../secrets.js";
import { updateBot } from "../../dynamodb/bot.repository.js";
import type { WhatsAppSyncStatus } from "../../../types/index.js";

export async function startCoexistenceSync(params: {
  tenantId: string;
  botId: string;
  phoneNumberId: string;
  environment: string;
}): Promise<WhatsAppSyncStatus> {
  const { tenantId, botId, phoneNumberId, environment } = params;
  const accessToken = await getWhatsAppAccessToken(tenantId, environment);
  const startedAt = new Date().toISOString();

  const syncStatus: WhatsAppSyncStatus = {
    contacts: "in_progress",
    history: "pending",
    startedAt,
  };

  await updateBot(tenantId, botId, {
    whatsappSyncStatus: syncStatus,
    whatsappOnboardingMode: "coexistence",
  });

  try {
    const contactsResult = await requestSmbAppData(
      phoneNumberId,
      accessToken,
      "smb_app_state_sync"
    );
    syncStatus.contactsRequestId = contactsResult.requestId;
  } catch (error) {
    syncStatus.contacts = "failed";
    syncStatus.lastError = (error as Error).message;
    await updateBot(tenantId, botId, { whatsappSyncStatus: syncStatus });
    throw error;
  }

  try {
    const historyResult = await requestSmbAppData(phoneNumberId, accessToken, "history");
    syncStatus.history = "in_progress";
    syncStatus.historyRequestId = historyResult.requestId;
  } catch (error) {
    syncStatus.history = "failed";
    syncStatus.lastError = (error as Error).message;
    await updateBot(tenantId, botId, { whatsappSyncStatus: syncStatus });
    throw error;
  }

  await updateBot(tenantId, botId, { whatsappSyncStatus: syncStatus });
  return syncStatus;
}
