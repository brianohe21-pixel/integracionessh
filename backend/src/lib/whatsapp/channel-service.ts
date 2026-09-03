import { randomUUID } from "crypto";
import { deleteWabaLookup } from "../dynamodb/bot-lookup.repository.js";
import { getBot, updateBot } from "../dynamodb/bot.repository.js";
import {
  getWhatsAppAccountByWabaId,
  upsertWhatsAppAccount,
} from "../dynamodb/whatsapp-account.repository.js";
import {
  countWhatsAppChannels,
  createWhatsAppChannel,
  getWhatsAppChannel,
  getWhatsAppChannelByPhoneNumberId,
  listWhatsAppChannels,
  updateWhatsAppChannel,
} from "../dynamodb/whatsapp-channel.repository.js";
import { assertCanAddWhatsAppChannel } from "../billing/assert-plan.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  completeEmbeddedSignup,
  completeCoexistenceSignup,
  completeManualConnect,
  assertDistinctWabaAndPhone,
} from "./embedded-signup.js";
import { getPhoneNumberInfo, registerPhoneNumber } from "./client.js";
import {
  getWhatsAppAccessToken,
  getWhatsAppAccessTokenForAccount,
  saveWhatsAppAccountSecret,
  saveTenantWhatsAppSecret,
} from "./secrets.js";
import type { WhatsAppChannel } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

async function ensureAccount(params: {
  tenantId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
  label?: string;
}): Promise<string> {
  const existing = await getWhatsAppAccountByWabaId(params.wabaId);
  const accountId = existing?.accountId ?? randomUUID();

  await saveWhatsAppAccountSecret(params.tenantId, accountId, ENVIRONMENT, {
    accessToken: params.accessToken,
    appSecret: params.appSecret,
  });

  await saveTenantWhatsAppSecret(params.tenantId, ENVIRONMENT, {
    accessToken: params.accessToken,
    appSecret: params.appSecret,
  });

  await upsertWhatsAppAccount({
    accountId,
    tenantId: params.tenantId,
    wabaId: params.wabaId,
    status: "active",
    ...(params.label ? { label: params.label } : {}),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return accountId;
}

async function syncBotLegacyFields(
  tenantId: string,
  botId: string,
  channel: WhatsAppChannel
): Promise<void> {
  if (!channel.isDefault) return;
  await updateBot(tenantId, botId, {
    phoneNumberId: channel.phoneNumberId,
    whatsappBusinessAccountId: channel.whatsappBusinessAccountId,
    ...(channel.whatsappOnboardingMode
      ? { whatsappOnboardingMode: channel.whatsappOnboardingMode }
      : {}),
    ...(channel.isOnBizApp !== undefined ? { isOnBizApp: channel.isOnBizApp } : {}),
    ...(channel.platformType ? { platformType: channel.platformType } : {}),
  });
}

async function assertCanConnectPhone(
  tenantId: string,
  botId: string,
  phoneNumberId: string
): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw Object.assign(new Error("Tenant not found"), { statusCode: 404 });

  const existingPhone = await getWhatsAppChannelByPhoneNumberId(phoneNumberId);
  if (existingPhone && existingPhone.botId !== botId) {
    throw Object.assign(new Error("Phone number is already connected to another bot"), {
      statusCode: 409,
    });
  }
  if (!existingPhone) {
    await assertCanAddWhatsAppChannel(tenant, botId);
  }
}

export async function connectWhatsAppChannelEmbedded(params: {
  tenantId: string;
  botId: string;
  code: string;
  wabaId: string;
  phoneNumberId?: string;
  pin?: string;
  appId: string;
  appSecret: string;
  platformAppSecret: string;
  label?: string;
}): Promise<WhatsAppChannel> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) throw Object.assign(new Error("Bot not found"), { statusCode: 404 });

  const signup = await completeEmbeddedSignup({
    tenantId: params.tenantId,
    environment: ENVIRONMENT,
    code: params.code,
    wabaId: params.wabaId,
    ...(params.phoneNumberId ? { phoneNumberId: params.phoneNumberId } : {}),
    ...(params.pin ? { pin: params.pin } : {}),
    appId: params.appId,
    appSecret: params.appSecret,
    platformAppSecret: params.platformAppSecret,
  });

  const accessToken = await getWhatsAppAccessToken(params.tenantId, ENVIRONMENT);
  const accountId = await ensureAccount({
    tenantId: params.tenantId,
    wabaId: signup.whatsappBusinessAccountId,
    accessToken,
    appSecret: params.platformAppSecret,
    ...(params.label ? { label: params.label } : {}),
  });

  if (!signup.phoneNumberId) {
    const err = new Error(
      "WhatsApp account connected but no phone number was found. Add a number in Meta and reconnect."
    ) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  await assertCanConnectPhone(params.tenantId, params.botId, signup.phoneNumberId);
  assertDistinctWabaAndPhone(signup.whatsappBusinessAccountId, signup.phoneNumberId);

  let displayPhoneNumber: string | undefined;
  try {
    const phoneInfo = await getPhoneNumberInfo(signup.phoneNumberId, accessToken);
    displayPhoneNumber = phoneInfo.displayPhoneNumber;
  } catch {
    displayPhoneNumber = undefined;
  }

  const currentCount = await countWhatsAppChannels(params.tenantId, params.botId);
  const channel = await createWhatsAppChannel({
    tenantId: params.tenantId,
    botId: params.botId,
    accountId,
    phoneNumberId: signup.phoneNumberId,
    whatsappBusinessAccountId: signup.whatsappBusinessAccountId,
    status: signup.needsRegistration ? "pending_registration" : "active",
    isDefault: currentCount === 0,
    whatsappOnboardingMode: "cloud_api",
    ...(params.label ? { label: params.label } : {}),
    ...(displayPhoneNumber ? { displayPhoneNumber } : {}),
  });

  if (channel.status === "active") {
    await syncBotLegacyFields(params.tenantId, params.botId, channel);
  }
  return channel;
}

export async function connectWhatsAppChannelCoexistence(params: {
  tenantId: string;
  botId: string;
  code: string;
  wabaId: string;
  phoneNumberId?: string;
  appId: string;
  appSecret: string;
  platformAppSecret: string;
  label?: string;
}): Promise<WhatsAppChannel> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) throw Object.assign(new Error("Bot not found"), { statusCode: 404 });

  const signup = await completeCoexistenceSignup({
    tenantId: params.tenantId,
    environment: ENVIRONMENT,
    code: params.code,
    wabaId: params.wabaId,
    ...(params.phoneNumberId ? { phoneNumberId: params.phoneNumberId } : {}),
    appId: params.appId,
    appSecret: params.appSecret,
    platformAppSecret: params.platformAppSecret,
  });

  await assertCanConnectPhone(params.tenantId, params.botId, signup.phoneNumberId);
  assertDistinctWabaAndPhone(signup.whatsappBusinessAccountId, signup.phoneNumberId);

  const accessToken = await getWhatsAppAccessToken(params.tenantId, ENVIRONMENT);
  const accountId = await ensureAccount({
    tenantId: params.tenantId,
    wabaId: signup.whatsappBusinessAccountId,
    accessToken,
    appSecret: params.platformAppSecret,
    ...(params.label ? { label: params.label } : {}),
  });

  let displayPhoneNumber: string | undefined;
  try {
    const phoneInfo = await getPhoneNumberInfo(signup.phoneNumberId, accessToken);
    displayPhoneNumber = phoneInfo.displayPhoneNumber;
  } catch {
    displayPhoneNumber = undefined;
  }

  const currentCount = await countWhatsAppChannels(params.tenantId, params.botId);
  const channel = await createWhatsAppChannel({
    tenantId: params.tenantId,
    botId: params.botId,
    accountId,
    phoneNumberId: signup.phoneNumberId,
    whatsappBusinessAccountId: signup.whatsappBusinessAccountId,
    status: "active",
    isDefault: currentCount === 0,
    whatsappOnboardingMode: "coexistence",
    isOnBizApp: signup.isOnBizApp,
    platformType: signup.platformType,
    ...(params.label ? { label: params.label } : {}),
    ...(displayPhoneNumber ? { displayPhoneNumber } : {}),
  });

  await syncBotLegacyFields(params.tenantId, params.botId, channel);
  return channel;
}

export async function connectWhatsAppChannelManual(params: {
  tenantId: string;
  botId: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  pin: string;
  platformAppSecret: string;
  label?: string;
}): Promise<WhatsAppChannel> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) throw Object.assign(new Error("Bot not found"), { statusCode: 404 });

  await assertCanConnectPhone(params.tenantId, params.botId, params.phoneNumberId);

  const signup = await completeManualConnect({
    tenantId: params.tenantId,
    environment: ENVIRONMENT,
    accessToken: params.accessToken,
    wabaId: params.wabaId,
    phoneNumberId: params.phoneNumberId,
    pin: params.pin,
    platformAppSecret: params.platformAppSecret,
  });

  const accountId = await ensureAccount({
    tenantId: params.tenantId,
    wabaId: signup.whatsappBusinessAccountId,
    accessToken: params.accessToken,
    appSecret: params.platformAppSecret,
    ...(params.label ? { label: params.label } : {}),
  });

  let displayPhoneNumber: string | undefined;
  try {
    const phoneInfo = await getPhoneNumberInfo(signup.phoneNumberId, params.accessToken);
    displayPhoneNumber = phoneInfo.displayPhoneNumber;
  } catch {
    displayPhoneNumber = undefined;
  }

  const currentCount = await countWhatsAppChannels(params.tenantId, params.botId);
  const channel = await createWhatsAppChannel({
    tenantId: params.tenantId,
    botId: params.botId,
    accountId,
    phoneNumberId: signup.phoneNumberId,
    whatsappBusinessAccountId: signup.whatsappBusinessAccountId,
    status: "active",
    isDefault: currentCount === 0,
    whatsappOnboardingMode: "cloud_api",
    ...(params.label ? { label: params.label } : {}),
    ...(displayPhoneNumber ? { displayPhoneNumber } : {}),
  });

  await syncBotLegacyFields(params.tenantId, params.botId, channel);
  return channel;
}

export async function registerWhatsAppChannelPhone(params: {
  tenantId: string;
  botId: string;
  channelId: string;
  pin: string;
}): Promise<{ success: boolean }> {
  const channel = await getWhatsAppChannel(params.tenantId, params.botId, params.channelId);
  if (!channel) throw Object.assign(new Error("Channel not found"), { statusCode: 404 });

  const accessToken = await getWhatsAppAccessTokenForAccount(
    params.tenantId,
    channel.accountId,
    ENVIRONMENT
  );

  const result = await registerPhoneNumber(channel.phoneNumberId, accessToken, params.pin);

  let displayPhoneNumber: string | undefined;
  try {
    const phoneInfo = await getPhoneNumberInfo(channel.phoneNumberId, accessToken);
    displayPhoneNumber = phoneInfo.displayPhoneNumber;
  } catch {
    displayPhoneNumber = undefined;
  }

  await updateWhatsAppChannel(params.tenantId, params.botId, params.channelId, {
    status: "active",
    ...(displayPhoneNumber ? { displayPhoneNumber } : {}),
  });

  const updated = await getWhatsAppChannel(params.tenantId, params.botId, params.channelId);
  if (updated?.isDefault) {
    await syncBotLegacyFields(params.tenantId, params.botId, updated);
  }

  return { success: result.success };
}

async function clearBotLegacyWhatsAppFields(
  tenantId: string,
  botId: string
): Promise<void> {
  const bot = await getBot(tenantId, botId);
  if (!bot) return;

  if (bot.whatsappBusinessAccountId?.trim()) {
    await deleteWabaLookup(bot.whatsappBusinessAccountId);
  }

  await updateBot(tenantId, botId, {
    phoneNumberId: "",
    whatsappBusinessAccountId: "",
    whatsappOnboardingMode: undefined,
    isOnBizApp: undefined,
    platformType: undefined,
    whatsappSyncStatus: undefined,
    whatsappDisconnectedAt: undefined,
    whatsappDisconnectionReason: undefined,
  });
}

export async function syncBotAfterChannelDelete(params: {
  tenantId: string;
  botId: string;
  deletedChannel: WhatsAppChannel;
}): Promise<void> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return;

  const shouldSync =
    params.deletedChannel.isDefault ||
    bot.phoneNumberId === params.deletedChannel.phoneNumberId;
  if (!shouldSync) return;

  const remaining = (await listWhatsAppChannels(params.tenantId, params.botId)).filter(
    (channel) => channel.status !== "disconnected"
  );

  if (remaining.length === 0) {
    await clearBotLegacyWhatsAppFields(params.tenantId, params.botId);
    return;
  }

  const nextDefault = remaining.find((channel) => channel.isDefault) ?? remaining[0];
  if (!nextDefault) return;

  if (!nextDefault.isDefault) {
    await updateWhatsAppChannel(params.tenantId, params.botId, nextDefault.channelId, {
      isDefault: true,
    });
    await syncBotLegacyFields(params.tenantId, params.botId, {
      ...nextDefault,
      isDefault: true,
    });
    return;
  }

  await syncBotLegacyFields(params.tenantId, params.botId, nextDefault);
}
