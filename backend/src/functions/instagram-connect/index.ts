import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import {
  deleteInstagramPageLookup,
  putInstagramPageLookup,
} from "../../lib/dynamodb/bot-lookup.repository.js";
import { saveInstagramSecret } from "../../lib/instagram/secrets.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ConnectSchema = z.object({
  botId: z.string().uuid(),
  pageId: z.string().min(1),
  pageAccessToken: z.string().min(1),
  instagramAccountId: z.string().optional(),
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

    if (bot.instagramPageId && bot.instagramPageId !== parsed.data.pageId) {
      await deleteInstagramPageLookup(bot.instagramPageId);
    }

    await saveInstagramSecret(auth.tenantId, ENVIRONMENT, {
      pageAccessToken: parsed.data.pageAccessToken,
      pageId: parsed.data.pageId,
      ...(parsed.data.instagramAccountId
        ? { instagramAccountId: parsed.data.instagramAccountId }
        : {}),
    });

    await putInstagramPageLookup(parsed.data.pageId, auth.tenantId, parsed.data.botId);

    const updated = await updateBot(auth.tenantId, parsed.data.botId, {
      instagramPageId: parsed.data.pageId,
      ...(parsed.data.instagramAccountId
        ? { instagramAccountId: parsed.data.instagramAccountId }
        : {}),
    });

    return ok({
      connected: true,
      botId: updated.botId,
      instagramPageId: updated.instagramPageId,
    });
  } catch (error) {
    return handleError(error);
  }
}
