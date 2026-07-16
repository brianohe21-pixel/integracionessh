import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { listBots } from "../../lib/dynamodb/bot.repository.js";
import { completeEmbeddedSignup, completeManualConnect } from "../../lib/whatsapp/embedded-signup.js";
import { registerPhoneNumber } from "../../lib/whatsapp/client.js";
import { getWhatsAppAccessToken } from "../../lib/whatsapp/secrets.js";
import { ok, badRequest, notFound, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

const PinSchema = z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits");

const ConnectSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  pin: PinSchema,
});

const RegisterSchema = z.object({
  phoneNumberId: z.string().min(1),
  pin: PinSchema,
});

const ConnectManualSchema = z.object({
  accessToken: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  pin: PinSchema,
});

async function handleConnect(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
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
    pin: parsed.data.pin,
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
  });

  return ok({
    connected: true,
    phoneNumberId: result.phoneNumberId,
    whatsappBusinessAccountId: result.whatsappBusinessAccountId,
  });
}

async function handleConnectManual(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const auth = extractAuthContext(event);
  assertMemberRole(auth);
  const body = JSON.parse(event.body ?? "{}");
  const parsed = ConnectManualSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const result = await completeManualConnect({
    tenantId: auth.tenantId,
    environment: ENVIRONMENT,
    accessToken: parsed.data.accessToken,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId,
    pin: parsed.data.pin,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
  });

  return ok({
    connected: true,
    phoneNumberId: result.phoneNumberId,
    whatsappBusinessAccountId: result.whatsappBusinessAccountId,
  });
}

async function handleRegister(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const auth = extractAuthContext(event);
  assertMemberRole(auth);
  const body = JSON.parse(event.body ?? "{}");
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const bots = await listBots(auth.tenantId);
  const ownsPhone = bots.some((bot) => bot.phoneNumberId === parsed.data.phoneNumberId);
  if (!ownsPhone) {
    return notFound("Phone number not found for this account");
  }

  const accessToken = await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
  const result = await registerPhoneNumber(
    parsed.data.phoneNumberId,
    accessToken,
    parsed.data.pin
  );

  return ok({
    registered: result.success,
    phoneNumberId: parsed.data.phoneNumberId,
  });
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    if (event.requestContext.http.method !== "POST") {
      return badRequest("Method not allowed");
    }

    const path = event.rawPath ?? event.requestContext.http.path;
    if (path.endsWith("/register")) {
      return await handleRegister(event);
    }
    if (path.endsWith("/connect-manual")) {
      return await handleConnectManual(event);
    }

    return await handleConnect(event);
  } catch (error) {
    return handleError(error);
  }
}
