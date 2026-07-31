import type { Channel } from "../../types/index.js";
import { getWhatsAppAccessToken } from "../whatsapp/client.js";
import { getInstagramAccessToken } from "../instagram/secrets.js";
import { getTelegramBotToken } from "../telegram/secrets.js";
import { getMessengerAccessToken } from "../messenger/secrets.js";

export async function resolveAccessTokenForBot(
  tenantId: string,
  botId: string,
  channel: Channel,
  environment: string
): Promise<string | undefined> {
  if (channel === "instagram") {
    return getInstagramAccessToken(tenantId, environment);
  }
  if (channel === "whatsapp") {
    return getWhatsAppAccessToken(tenantId, environment);
  }
  if (channel === "telegram") {
    return getTelegramBotToken(tenantId, botId, environment);
  }
  if (channel === "messenger") {
    return getMessengerAccessToken(tenantId, botId, environment);
  }
  return undefined;
}
