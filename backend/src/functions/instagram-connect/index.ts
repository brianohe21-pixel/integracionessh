import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { connectInstagramBot } from "../../lib/instagram/connect-bot.js";
import { resolveInstagramPageFromLogin } from "../../lib/instagram/login-for-business.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";

const ManualConnectSchema = z.object({
  botId: z.string().uuid(),
  pageId: z.string().min(1).optional(),
  pageAccessToken: z.string().min(1),
  instagramAccountId: z.string().min(1).optional(),
});

const LoginConnectSchema = z
  .object({
    botId: z.string().uuid(),
    code: z.string().min(1).optional(),
    userAccessToken: z.string().min(1).optional(),
    pageId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.code || data.userAccessToken), {
    message: "code or userAccessToken is required",
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

    if (typeof body.pageAccessToken === "string" && body.pageAccessToken.trim()) {
      const parsed = ManualConnectSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      try {
        const result = await connectInstagramBot({
          tenantId: auth.tenantId,
          email: auth.email,
          ...(auth.name ? { name: auth.name } : {}),
          botId: parsed.data.botId,
          pageAccessToken: parsed.data.pageAccessToken,
          ...(parsed.data.pageId ? { pageId: parsed.data.pageId } : {}),
          ...(parsed.data.instagramAccountId
            ? { instagramAccountId: parsed.data.instagramAccountId }
            : {}),
          environment: ENVIRONMENT,
          ...(META_APP_ID && META_APP_SECRET
            ? { metaAppId: META_APP_ID, metaAppSecret: META_APP_SECRET }
            : {}),
        });
        return ok(result);
      } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode;
        if (statusCode === 400) return badRequest((error as Error).message);
        throw error;
      }
    }

    const parsed = LoginConnectSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    if (!META_APP_ID || !META_APP_SECRET) {
      return badRequest("Meta app credentials are not configured on the server");
    }

    let resolved;
    try {
      resolved = await resolveInstagramPageFromLogin({
        ...(parsed.data.code ? { code: parsed.data.code } : {}),
        ...(parsed.data.userAccessToken
          ? { userAccessToken: parsed.data.userAccessToken }
          : {}),
        ...(parsed.data.pageId ? { preferredPageId: parsed.data.pageId } : {}),
        appId: META_APP_ID,
        appSecret: META_APP_SECRET,
      });
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode;
      if (statusCode === 400) return badRequest((error as Error).message);
      throw error;
    }

    if (resolved.status === "needs_selection") {
      return ok({
        needsSelection: true,
        pages: resolved.pages.map((page) => ({
          pageId: page.pageId,
          pageName: page.pageName,
          instagramAccountId: page.instagramAccountId,
          ...(page.instagramUsername ? { instagramUsername: page.instagramUsername } : {}),
          pageAccessToken: page.pageAccessToken,
        })),
      });
    }

    try {
      const result = await connectInstagramBot({
        tenantId: auth.tenantId,
        email: auth.email,
        ...(auth.name ? { name: auth.name } : {}),
        botId: parsed.data.botId,
        pageAccessToken: resolved.page.pageAccessToken,
        pageId: resolved.page.pageId,
        instagramAccountId: resolved.page.instagramAccountId,
        environment: ENVIRONMENT,
        metaAppId: META_APP_ID,
        metaAppSecret: META_APP_SECRET,
      });
      return ok(result);
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode;
      if (statusCode === 400) return badRequest((error as Error).message);
      throw error;
    }
  } catch (error) {
    return handleError(error);
  }
}
