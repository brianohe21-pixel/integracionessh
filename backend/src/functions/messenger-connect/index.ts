import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import {
  deleteMessengerPageLookup,
  putMessengerPageLookup,
} from "../../lib/dynamodb/bot-lookup.repository.js";
import { saveMessengerSecret } from "../../lib/messenger/secrets.js";
import { assertCanEnableChannel } from "../../lib/billing/assert-plan.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ConnectSchema = z.object({
  botId: z.string().uuid(),
  pageId: z.string().min(1),
  pageAccessToken: z.string().min(1),
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
    await assertCanEnableChannel(tenant, bot, "messenger");

    if (bot.messengerPageId && bot.messengerPageId !== parsed.data.pageId) {
      await deleteMessengerPageLookup(bot.messengerPageId);
    }

    await saveMessengerSecret(auth.tenantId, parsed.data.botId, ENVIRONMENT, {
      pageAccessToken: parsed.data.pageAccessToken,
      pageId: parsed.data.pageId,
    });

    await putMessengerPageLookup(parsed.data.pageId, auth.tenantId, parsed.data.botId);

    const updated = await updateBot(auth.tenantId, parsed.data.botId, {
      messengerPageId: parsed.data.pageId,
    });

    return ok({
      connected: true,
      messengerPageId: updated.messengerPageId,
    });
  } catch (error) {
    return handleError(error);
  }
}
