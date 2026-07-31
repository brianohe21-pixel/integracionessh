import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import {
  deleteMessengerPageLookup,
  putMessengerPageLookup,
} from "../../lib/dynamodb/bot-lookup.repository.js";
import { saveMessengerSecret } from "../../lib/messenger/secrets.js";
import { verifyMessengerPageToken } from "../../lib/messenger/verify-token.js";
import { assertCanEnableChannel } from "../../lib/billing/assert-plan.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";

const ConnectSchema = z.object({
  botId: z.string().uuid(),
  pageId: z.string().min(1).optional(),
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

    let verifiedPage;
    try {
      verifiedPage = await verifyMessengerPageToken(parsed.data.pageAccessToken, {
        ...(parsed.data.pageId ? { expectedPageId: parsed.data.pageId } : {}),
        ...(META_APP_ID && META_APP_SECRET
          ? { metaAppId: META_APP_ID, metaAppSecret: META_APP_SECRET }
          : {}),
      });
    } catch (error) {
      return badRequest((error as Error).message);
    }

    const pageId = verifiedPage.pageId;

    if (bot.messengerPageId && bot.messengerPageId !== pageId) {
      await deleteMessengerPageLookup(bot.messengerPageId);
    }

    await saveMessengerSecret(auth.tenantId, parsed.data.botId, ENVIRONMENT, {
      pageAccessToken: parsed.data.pageAccessToken,
      pageId,
    });

    await putMessengerPageLookup(pageId, auth.tenantId, parsed.data.botId);

    const updated = await updateBot(auth.tenantId, parsed.data.botId, {
      messengerPageId: pageId,
    });

    return ok({
      connected: true,
      messengerPageId: updated.messengerPageId,
      pageName: verifiedPage.pageName,
    });
  } catch (error) {
    return handleError(error);
  }
}
