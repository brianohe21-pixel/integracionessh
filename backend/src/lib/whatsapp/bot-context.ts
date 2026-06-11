import { ResourceNotFoundException } from "@aws-sdk/client-secrets-manager";
import { getBot } from "../dynamodb/bot.repository.js";
import { getWhatsAppAccessToken } from "./client.js";
import type { Bot } from "../../types/index.js";

export async function loadBotAndToken(
  tenantId: string,
  botId: string,
  environment: string
): Promise<{ bot: Bot; accessToken: string }> {
  const bot = await getBot(tenantId, botId);
  if (!bot) {
    throw Object.assign(new Error("Bot not found"), { statusCode: 404 });
  }

  let accessToken: string;
  try {
    accessToken = await getWhatsAppAccessToken(tenantId, environment);
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      throw Object.assign(
        new Error("WhatsApp is not connected. Complete WhatsApp setup in bot settings."),
        { statusCode: 400 }
      );
    }
    throw error;
  }

  if (!accessToken.trim()) {
    throw Object.assign(
      new Error("WhatsApp access token is missing. Reconnect WhatsApp in bot settings."),
      { statusCode: 400 }
    );
  }

  return { bot, accessToken };
}
