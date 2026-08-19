import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { listBots } from "../../lib/dynamodb/bot.repository.js";
import {
  completeEmbeddedSignup,
  completeCoexistenceSignup,
  completeManualConnect,
} from "../../lib/whatsapp/embedded-signup.js";
import { registerPhoneNumber } from "../../lib/whatsapp/client.js";
import { getWhatsAppAccessToken } from "../../lib/whatsapp/secrets.js";
import { ok, badRequest, notFound, handleError } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

const PinSchema = z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits");

const ConnectSchema = z
  .object({
    code: z.string().min(1),
    wabaId: z.string().min(1),
    phoneNumberId: z.string().optional(),
    pin: z.string().optional(),
    onboardingMode: z.enum(["cloud_api", "coexistence"]).optional().default("cloud_api"),
  })
  .superRefine((data, ctx) => {
    if (data.onboardingMode === "cloud_api") {
      if (!data.phoneNumberId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "phoneNumberId is required for Cloud API onboarding",
        });
      }
      if (!data.pin || !/^\d{6}$/.test(data.pin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PIN must be exactly 6 digits",
        });
      }
    }
  });

const ConnectCoexistenceSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().optional(),
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

  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  const body = JSON.parse(event.body ?? "{}");
  const parsed = ConnectSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  if (parsed.data.onboardingMode === "coexistence") {
    const coexistence = await completeCoexistenceSignup({
      tenantId: auth.tenantId,
      environment: ENVIRONMENT,
      code: parsed.data.code,
      wabaId: parsed.data.wabaId,
      ...(parsed.data.phoneNumberId ? { phoneNumberId: parsed.data.phoneNumberId } : {}),
      appId: META_APP_ID,
      appSecret: META_APP_SECRET,
      platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
    });

    return ok({
      connected: true,
      onboardingMode: "coexistence",
      phoneNumberId: coexistence.phoneNumberId,
      whatsappBusinessAccountId: coexistence.whatsappBusinessAccountId,
      isOnBizApp: coexistence.isOnBizApp,
      platformType: coexistence.platformType,
    });
  }

  const result = await completeEmbeddedSignup({
    tenantId: auth.tenantId,
    environment: ENVIRONMENT,
    code: parsed.data.code,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId!,
    pin: parsed.data.pin!,
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
  });

  return ok({
    connected: true,
    onboardingMode: "cloud_api",
    phoneNumberId: result.phoneNumberId,
    whatsappBusinessAccountId: result.whatsappBusinessAccountId,
  });
}

async function handleConnectCoexistence(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  if (!META_APP_ID || !META_APP_SECRET) {
    return badRequest("WhatsApp embedded signup is not configured on the server");
  }

  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  const body = JSON.parse(event.body ?? "{}");
  const parsed = ConnectCoexistenceSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const result = await completeCoexistenceSignup({
    tenantId: auth.tenantId,
    environment: ENVIRONMENT,
    code: parsed.data.code,
    wabaId: parsed.data.wabaId,
    ...(parsed.data.phoneNumberId ? { phoneNumberId: parsed.data.phoneNumberId } : {}),
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
  });

  return ok({
    connected: true,
    onboardingMode: "coexistence",
    phoneNumberId: result.phoneNumberId,
    whatsappBusinessAccountId: result.whatsappBusinessAccountId,
    isOnBizApp: result.isOnBizApp,
    platformType: result.platformType,
  });
}

async function handleConnectManual(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
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
    onboardingMode: "cloud_api",
    phoneNumberId: result.phoneNumberId,
    whatsappBusinessAccountId: result.whatsappBusinessAccountId,
  });
}

async function handleRegister(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
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

async function handleStatus(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");

  let connected = false;
  try {
    await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
    connected = true;
  } catch {
    connected = false;
  }

  const bots = await listBots(auth.tenantId);
  const whatsappBot = bots.find((b) => b.phoneNumberId?.trim()) ?? bots[0];

  return ok({
    connected,
    ...(whatsappBot?.phoneNumberId ? { phoneNumberId: whatsappBot.phoneNumberId } : {}),
    ...(whatsappBot?.whatsappBusinessAccountId
      ? { whatsappBusinessAccountId: whatsappBot.whatsappBusinessAccountId }
      : {}),
    ...(whatsappBot?.whatsappOnboardingMode
      ? { onboardingMode: whatsappBot.whatsappOnboardingMode }
      : {}),
    ...(whatsappBot?.isOnBizApp !== undefined ? { isOnBizApp: whatsappBot.isOnBizApp } : {}),
    ...(whatsappBot?.platformType ? { platformType: whatsappBot.platformType } : {}),
    ...(whatsappBot?.whatsappSyncStatus ? { syncStatus: whatsappBot.whatsappSyncStatus } : {}),
    ...(whatsappBot?.whatsappDisconnectedAt
      ? { disconnectedAt: whatsappBot.whatsappDisconnectedAt }
      : {}),
    ...(whatsappBot?.whatsappDisconnectionReason
      ? { disconnectionReason: whatsappBot.whatsappDisconnectionReason }
      : {}),
  });
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath ?? event.requestContext.http.path;

    if (method === "GET" && path.endsWith("/status")) {
      return await handleStatus(event);
    }

    if (method !== "POST") {
      return badRequest("Method not allowed");
    }

    if (path.endsWith("/register")) {
      return await handleRegister(event);
    }
    if (path.endsWith("/connect-manual")) {
      return await handleConnectManual(event);
    }
    if (path.endsWith("/connect-coexistence")) {
      return await handleConnectCoexistence(event);
    }

    return await handleConnect(event);
  } catch (error) {
    return handleError(error);
  }
}
