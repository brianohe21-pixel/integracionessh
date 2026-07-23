import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import { putTelegramBotLookup } from "../../lib/dynamodb/bot-lookup.repository.js";
import { saveTelegramSecret } from "../../lib/telegram/secrets.js";
import { setTelegramWebhook, getTelegramBotInfo } from "../../lib/telegram/client.js";
import { assertCanEnableChannel } from "../../lib/billing/assert-plan.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? "";

const ConnectSchema = z.object({
  botId: z.string().uuid(),
  botToken: z.string().min(1),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.requestContext.http.method !== "POST") {
      return badRequest("Method not allowed");
    }

    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const body = JSON.parse(event.body ?? "{}");
    const parsed = ConnectSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const bot = await getBot(auth.tenantId, parsed.data.botId);
    if (!bot) return badRequest("Bot not found");

    const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
    await assertCanEnableChannel(tenant, bot, "telegram");

    const secrets = await saveTelegramSecret(
      auth.tenantId,
      parsed.data.botId,
      ENVIRONMENT,
      { botToken: parsed.data.botToken }
    );

    await putTelegramBotLookup(parsed.data.botId, auth.tenantId);

    if (API_PUBLIC_URL) {
      const webhookUrl = `${API_PUBLIC_URL.replace(/\/$/, "")}/telegram/webhook/${parsed.data.botId}`;
      await setTelegramWebhook({
        botToken: parsed.data.botToken,
        webhookUrl,
        secretToken: secrets.webhookSecret,
      });
    }

    const botInfo = await getTelegramBotInfo(parsed.data.botToken);
    const updated = await updateBot(auth.tenantId, parsed.data.botId, {
      telegramEnabled: true,
      ...(botInfo.username ? { telegramBotUsername: botInfo.username } : {}),
    });

    return ok({
      connected: true,
      telegramEnabled: updated.telegramEnabled,
      telegramBotUsername: updated.telegramBotUsername,
      webhookUrl: API_PUBLIC_URL
        ? `${API_PUBLIC_URL.replace(/\/$/, "")}/telegram/webhook/${parsed.data.botId}`
        : undefined,
    });
  } catch (error) {
    return handleError(error);
  }
}
