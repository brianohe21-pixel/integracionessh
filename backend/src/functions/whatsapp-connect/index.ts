import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  completeCoexistenceSignup,
} from "../../lib/whatsapp/embedded-signup.js";
import { registerPhoneNumber, sendTemplateMessage } from "../../lib/whatsapp/client.js";
import { buildWhatsAppCloudApiTemplateCurl } from "../../lib/whatsapp/cloud-api-curl.js";
import { getWhatsAppAccessToken, getWhatsAppAccessTokenForAccount } from "../../lib/whatsapp/secrets.js";
import {
  connectWhatsAppChannelEmbedded,
  connectWhatsAppChannelManual,
  registerWhatsAppChannelPhone,
} from "../../lib/whatsapp/channel-service.js";
import {
  deleteWhatsAppChannel,
  getDefaultWhatsAppChannel,
  getWhatsAppChannel,
  listWhatsAppChannels,
  updateWhatsAppChannel,
} from "../../lib/dynamodb/whatsapp-channel.repository.js";
import { listBots } from "../../lib/dynamodb/bot.repository.js";
import { ok, badRequest, notFound, noContent, handleError } from "../../lib/http.js";

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
    label: z.string().max(128).optional(),
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
  label: z.string().max(128).optional(),
});

const UpdateChannelSchema = z.object({
  label: z.string().max(128).optional(),
  isDefault: z.boolean().optional(),
});

const TestSendSchema = z.object({
  to: z.string().min(8).max(20),
  templateName: z.string().min(1).max(128).optional().default("hello_world"),
  language: z.string().min(2).max(16).optional().default("en_US"),
  phoneNumberId: z.string().min(1).optional(),
});

function normalizeRecipientPhone(value: string): string {
  return value.replace(/\D/g, "");
}

function extractBotId(path: string): string | null {
  const match = path.match(/\/bots\/([^/]+)\/whatsapp-channels/);
  return match?.[1] ?? null;
}

function extractChannelId(path: string): string | null {
  const match = path.match(/\/whatsapp-channels\/([^/]+)/);
  return match?.[1] ?? null;
}

async function assertBotAccess(tenantId: string, botId: string) {
  const bot = await getBot(tenantId, botId);
  if (!bot) throw Object.assign(new Error("Bot not found"), { statusCode: 404 });
  return bot;
}

async function handleListChannels(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);
  const channels = await listWhatsAppChannels(auth.tenantId, botId);
  return ok({ channels });
}

async function handleConnectChannel(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string
): Promise<APIGatewayProxyResultV2> {
  if (!META_APP_ID || !META_APP_SECRET) {
    return badRequest("WhatsApp embedded signup is not configured on the server");
  }

  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);

  const body = JSON.parse(event.body ?? "{}");
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const channel = await connectWhatsAppChannelEmbedded({
    tenantId: auth.tenantId,
    botId,
    code: parsed.data.code,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId!,
    pin: parsed.data.pin!,
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
    ...(parsed.data.label ? { label: parsed.data.label } : {}),
  });

  return ok({ connected: true, channel });
}

async function handleConnectManualChannel(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);

  const body = JSON.parse(event.body ?? "{}");
  const parsed = ConnectManualSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const channel = await connectWhatsAppChannelManual({
    tenantId: auth.tenantId,
    botId,
    accessToken: parsed.data.accessToken,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId,
    pin: parsed.data.pin,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
    ...(parsed.data.label ? { label: parsed.data.label } : {}),
  });

  return ok({ connected: true, channel });
}

async function handleRegisterChannel(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string,
  channelId: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);

  const body = JSON.parse(event.body ?? "{}");
  const parsed = z.object({ pin: PinSchema }).safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const result = await registerWhatsAppChannelPhone({
    tenantId: auth.tenantId,
    botId,
    channelId,
    pin: parsed.data.pin,
  });

  return ok({ registered: result.success, channelId });
}

async function handleUpdateChannel(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string,
  channelId: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);

  const body = JSON.parse(event.body ?? "{}");
  const parsed = UpdateChannelSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const channel = await updateWhatsAppChannel(
    auth.tenantId,
    botId,
    channelId,
    {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
    }
  );
  if (!channel) return notFound("Channel not found");
  return ok({ channel });
}

async function handleDeleteChannel(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string,
  channelId: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);

  const existing = await getWhatsAppChannel(auth.tenantId, botId, channelId);
  if (!existing) return notFound("Channel not found");

  await deleteWhatsAppChannel(auth.tenantId, botId, channelId);
  return noContent();
}

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

  const bots = await listBots(auth.tenantId);
  const bot = bots[0];
  if (!bot) return badRequest("Create a bot before connecting WhatsApp");

  const channel = await connectWhatsAppChannelEmbedded({
    tenantId: auth.tenantId,
    botId: bot.botId,
    code: parsed.data.code,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId!,
    pin: parsed.data.pin!,
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
    ...(parsed.data.label ? { label: parsed.data.label } : {}),
  });

  return ok({
    connected: true,
    onboardingMode: "cloud_api",
    phoneNumberId: channel.phoneNumberId,
    whatsappBusinessAccountId: channel.whatsappBusinessAccountId,
    channel,
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

  const bots = await listBots(auth.tenantId);
  const bot = bots[0];
  if (!bot) return badRequest("Create a bot before connecting WhatsApp");

  const channel = await connectWhatsAppChannelManual({
    tenantId: auth.tenantId,
    botId: bot.botId,
    accessToken: parsed.data.accessToken,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId,
    pin: parsed.data.pin,
    platformAppSecret: WHATSAPP_APP_SECRET || META_APP_SECRET,
    ...(parsed.data.label ? { label: parsed.data.label } : {}),
  });

  return ok({
    connected: true,
    onboardingMode: "cloud_api",
    phoneNumberId: channel.phoneNumberId,
    whatsappBusinessAccountId: channel.whatsappBusinessAccountId,
    channel,
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

async function handleTestSend(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  botId: string,
  channelId: string | null
): Promise<APIGatewayProxyResultV2> {
  const auth = await resolveRequestAuth(event);
  assertMemberRole(auth);
  await assertAssignedServices(auth.tenantId, "bots");
  await assertBotAccess(auth.tenantId, botId);

  const body = JSON.parse(event.body ?? "{}");
  const parsed = TestSendSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const to = normalizeRecipientPhone(parsed.data.to);
  if (to.length < 10) {
    return badRequest("Recipient phone number is invalid");
  }

  let phoneNumberId = "";
  let accessToken = "";

  if (channelId) {
    const channel = await getWhatsAppChannel(auth.tenantId, botId, channelId);
    if (!channel) return notFound("WhatsApp channel not found");
    if (channel.status !== "active") {
      return badRequest("WhatsApp channel is not active");
    }
    phoneNumberId = parsed.data.phoneNumberId?.trim() || channel.phoneNumberId;
    accessToken = await getWhatsAppAccessTokenForAccount(
      auth.tenantId,
      channel.accountId,
      ENVIRONMENT
    );
  } else {
    const bot = await getBot(auth.tenantId, botId);
    const defaultChannel = await getDefaultWhatsAppChannel(auth.tenantId, botId);
    if (defaultChannel?.status === "active") {
      phoneNumberId = parsed.data.phoneNumberId?.trim() || defaultChannel.phoneNumberId;
      accessToken = await getWhatsAppAccessTokenForAccount(
        auth.tenantId,
        defaultChannel.accountId,
        ENVIRONMENT
      );
    } else if (bot?.phoneNumberId?.trim()) {
      phoneNumberId = parsed.data.phoneNumberId?.trim() || bot.phoneNumberId.trim();
      accessToken = await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
    } else {
      return badRequest("No active WhatsApp number is connected to this bot");
    }
  }

  const templateName = parsed.data.templateName;
  const language = parsed.data.language;

  const result = await sendTemplateMessage({
    phoneNumberId,
    to,
    templateName,
    language,
    accessToken,
  });

  const messageId = result.messages?.[0]?.id ?? null;

  return ok({
    messageId,
    status: "accepted",
    to,
    phoneNumberId,
    templateName,
    language,
    curl: buildWhatsAppCloudApiTemplateCurl({
      phoneNumberId,
      to,
      templateName,
      language,
    }),
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
  const channels = (
    await Promise.all(bots.map((bot) => listWhatsAppChannels(auth.tenantId, bot.botId)))
  ).flat();

  const whatsappBot = bots.find((b) => b.phoneNumberId?.trim()) ?? bots[0];
  const defaultChannel = channels.find((c) => c.isDefault) ?? channels[0];

  return ok({
    connected: connected || channels.length > 0,
    channels,
    ...(defaultChannel?.phoneNumberId ? { phoneNumberId: defaultChannel.phoneNumberId } : {}),
    ...(defaultChannel?.whatsappBusinessAccountId
      ? { whatsappBusinessAccountId: defaultChannel.whatsappBusinessAccountId }
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
    const botId = extractBotId(path);
    const channelId = extractChannelId(path);

    if (botId && path.includes("/whatsapp-channels")) {
      if (method === "GET" && !channelId) {
        return await handleListChannels(event, botId);
      }
      if (method === "POST" && path.endsWith("/connect-manual")) {
        return await handleConnectManualChannel(event, botId);
      }
      if (method === "POST" && path.endsWith("/connect")) {
        return await handleConnectChannel(event, botId);
      }
      if (method === "POST" && path.endsWith("/test-send")) {
        const effectiveChannelId =
          channelId && channelId !== "test-send" ? channelId : null;
        return await handleTestSend(event, botId, effectiveChannelId);
      }
      if (method === "POST" && channelId && path.endsWith("/register")) {
        return await handleRegisterChannel(event, botId, channelId);
      }
      if ((method === "PATCH" || method === "PUT") && channelId) {
        return await handleUpdateChannel(event, botId, channelId);
      }
      if (method === "DELETE" && channelId) {
        return await handleDeleteChannel(event, botId, channelId);
      }
      return badRequest("Method not allowed");
    }

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
