import { getBot, updateBot } from "../dynamodb/bot.repository.js";
import {
  deleteInstagramPageLookup,
  putInstagramPageLookup,
} from "../dynamodb/bot-lookup.repository.js";
import { saveInstagramSecret } from "./secrets.js";
import { verifyInstagramPageToken } from "./verify-token.js";
import { subscribeInstagramPageWebhooks } from "./subscribe-page.js";
import { assertCanEnableChannel } from "../billing/assert-plan.js";
import { ensureTenant } from "../dynamodb/tenant.repository.js";

export type ConnectInstagramBotResult = {
  connected: true;
  botId: string;
  instagramPageId: string;
  instagramAccountId?: string;
  pageName: string;
  instagramUsername?: string;
};

export async function connectInstagramBot(params: {
  tenantId: string;
  email: string;
  name?: string;
  botId: string;
  pageAccessToken: string;
  pageId?: string;
  instagramAccountId?: string;
  environment: string;
  metaAppId?: string;
  metaAppSecret?: string;
}): Promise<ConnectInstagramBotResult> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) {
    const err = new Error("Bot not found") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const tenant = await ensureTenant(params.tenantId, params.email, params.name);
  await assertCanEnableChannel(tenant, bot, "instagram");

  let verified;
  try {
    verified = await verifyInstagramPageToken(params.pageAccessToken, {
      ...(params.pageId ? { expectedPageId: params.pageId } : {}),
      ...(params.instagramAccountId
        ? { expectedInstagramAccountId: params.instagramAccountId }
        : {}),
      ...(params.metaAppId && params.metaAppSecret
        ? { metaAppId: params.metaAppId, metaAppSecret: params.metaAppSecret }
        : {}),
    });
  } catch (error) {
    const err = new Error((error as Error).message) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const pageId = verified.pageId;
  const instagramAccountId = verified.instagramAccountId;

  if (bot.instagramPageId && bot.instagramPageId !== pageId) {
    await deleteInstagramPageLookup(bot.instagramPageId);
  }
  if (bot.instagramAccountId && bot.instagramAccountId !== instagramAccountId) {
    await deleteInstagramPageLookup(bot.instagramAccountId);
  }

  await saveInstagramSecret(params.tenantId, params.botId, params.environment, {
    pageAccessToken: params.pageAccessToken,
    pageId,
    instagramAccountId,
  });

  await putInstagramPageLookup(instagramAccountId, params.tenantId, params.botId);
  if (pageId !== instagramAccountId) {
    await putInstagramPageLookup(pageId, params.tenantId, params.botId);
  }

  try {
    await subscribeInstagramPageWebhooks(pageId, params.pageAccessToken);
  } catch (error) {
    const err = new Error((error as Error).message) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const updated = await updateBot(params.tenantId, params.botId, {
    instagramPageId: pageId,
    instagramAccountId,
  });

  return {
    connected: true,
    botId: updated.botId,
    instagramPageId: updated.instagramPageId ?? pageId,
    ...(updated.instagramAccountId ? { instagramAccountId: updated.instagramAccountId } : {}),
    pageName: verified.pageName,
    ...(verified.instagramUsername ? { instagramUsername: verified.instagramUsername } : {}),
  };
}
