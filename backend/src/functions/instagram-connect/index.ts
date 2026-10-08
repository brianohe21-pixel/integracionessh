import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import {
  deleteInstagramPageLookup,
  putInstagramPageLookup,
} from "../../lib/dynamodb/bot-lookup.repository.js";
import { saveInstagramSecret } from "../../lib/instagram/secrets.js";
import { verifyInstagramPageToken } from "../../lib/instagram/verify-token.js";
import { subscribeInstagramPageWebhooks } from "../../lib/instagram/subscribe-page.js";
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
  instagramAccountId: z.string().min(1).optional(),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.requestContext.http.method !== "POST") {
      return badRequest("Method not allowed");
    }

    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "bots");
    const body = JSON.parse(event.body ?? "{}");
    const parsed = ConnectSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const bot = await getBot(auth.tenantId, parsed.data.botId);
    if (!bot) return badRequest("Bot not found");

    const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
    await assertCanEnableChannel(tenant, bot, "instagram");

    let verified;
    try {
      verified = await verifyInstagramPageToken(parsed.data.pageAccessToken, {
        ...(parsed.data.pageId ? { expectedPageId: parsed.data.pageId } : {}),
        ...(parsed.data.instagramAccountId
          ? { expectedInstagramAccountId: parsed.data.instagramAccountId }
          : {}),
        ...(META_APP_ID && META_APP_SECRET
          ? { metaAppId: META_APP_ID, metaAppSecret: META_APP_SECRET }
          : {}),
      });
    } catch (error) {
      return badRequest((error as Error).message);
    }

    const pageId = verified.pageId;
    const instagramAccountId = verified.instagramAccountId;

    if (bot.instagramPageId && bot.instagramPageId !== pageId) {
      await deleteInstagramPageLookup(bot.instagramPageId);
    }
    if (bot.instagramAccountId && bot.instagramAccountId !== instagramAccountId) {
      await deleteInstagramPageLookup(bot.instagramAccountId);
    }

    await saveInstagramSecret(auth.tenantId, parsed.data.botId, ENVIRONMENT, {
      pageAccessToken: parsed.data.pageAccessToken,
      pageId,
      instagramAccountId,
    });

    await putInstagramPageLookup(instagramAccountId, auth.tenantId, parsed.data.botId);
    if (pageId !== instagramAccountId) {
      await putInstagramPageLookup(pageId, auth.tenantId, parsed.data.botId);
    }

    try {
      await subscribeInstagramPageWebhooks(pageId, parsed.data.pageAccessToken);
    } catch (error) {
      return badRequest((error as Error).message);
    }

    const updated = await updateBot(auth.tenantId, parsed.data.botId, {
      instagramPageId: pageId,
      instagramAccountId,
    });

    return ok({
      connected: true,
      botId: updated.botId,
      instagramPageId: updated.instagramPageId,
      instagramAccountId: updated.instagramAccountId,
      pageName: verified.pageName,
      ...(verified.instagramUsername ? { instagramUsername: verified.instagramUsername } : {}),
    });
  } catch (error) {
    return handleError(error);
  }
}
