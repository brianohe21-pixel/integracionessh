import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { completeEmbeddedSignup } from "../../lib/whatsapp/embedded-signup.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

const ConnectSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.requestContext.http.method !== "POST") {
      return badRequest("Method not allowed");
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return badRequest("WhatsApp embedded signup is not configured on the server");
    }

    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const body = JSON.parse(event.body ?? "{}");
    const parsed = ConnectSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.message);
    }

    const result = await completeEmbeddedSignup({
      tenantId: auth.tenantId,
      environment: ENVIRONMENT,
      code: parsed.data.code,
      wabaId: parsed.data.wabaId,
      phoneNumberId: parsed.data.phoneNumberId,
      appId: META_APP_ID,
      appSecret: META_APP_SECRET,
      platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
    });

    return ok({
      connected: true,
      phoneNumberId: result.phoneNumberId,
      whatsappBusinessAccountId: result.whatsappBusinessAccountId,
    });
  } catch (error) {
    return handleError(error);
  }
}
