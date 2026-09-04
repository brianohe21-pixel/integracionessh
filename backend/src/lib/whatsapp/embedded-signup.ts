import {
  getPhoneNumberInfo,
  listWabaPhoneNumbers,
  registerPhoneNumber,
  type WhatsAppPhoneInfo,
  type WabaPhoneNumberEntry,
} from "./client.js";
import { saveTenantWhatsAppSecret } from "./secrets.js";

const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

const COEXISTENCE_WEBHOOK_FIELDS = [
  "messages",
  "calls",
  "history",
  "smb_app_state_sync",
  "smb_message_echoes",
  "account_update",
  "account_alerts",
  "phone_number_quality_update",
];

const CLOUD_API_WEBHOOK_FIELDS = [
  "messages",
  "calls",
  "account_update",
  "account_alerts",
  "phone_number_quality_update",
];

export function assertDistinctWabaAndPhone(wabaId: string, phoneNumberId: string): void {
  if (wabaId === phoneNumberId) {
    const err = new Error(
      "whatsappBusinessAccountId must be the WABA ID, not the Phone Number ID"
    ) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  const response = await fetch(`${GRAPH_API_URL}/oauth/access_token?${params.toString()}`);

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Failed to exchange authorization code: ${body}`) as Error & {
      statusCode?: number;
    };
    err.statusCode = 502;
    throw err;
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    const err = new Error("Meta did not return an access token") as Error & { statusCode?: number };
    err.statusCode = 502;
    throw err;
  }

  return json.access_token;
}

export async function subscribeWabaWebhooks(
  wabaId: string,
  accessToken: string,
  fields: string[] = CLOUD_API_WEBHOOK_FIELDS
): Promise<void> {
  const response = await fetch(`${GRAPH_API_URL}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscribed_fields: fields,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Failed to subscribe WABA to webhooks: ${body}`) as Error & {
      statusCode?: number;
    };
    err.statusCode = 502;
    throw err;
  }
}

export function resolveCloudApiPhoneNumber(
  numbers: WabaPhoneNumberEntry[],
  hintPhoneNumberId?: string
): WabaPhoneNumberEntry | null {
  if (hintPhoneNumberId) {
    const byId = numbers.find((n) => n.id === hintPhoneNumberId);
    if (byId) return byId;
  }

  if (numbers.length === 1) {
    return numbers[0];
  }

  if (numbers.length > 1) {
    const err = new Error(
      "Multiple phone numbers found. Reconnect and select a single number in Meta."
    ) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  return null;
}

export function resolveCoexistencePhoneNumber(
  numbers: WabaPhoneNumberEntry[],
  hintPhoneNumberId?: string
): WabaPhoneNumberEntry {
  if (hintPhoneNumberId) {
    const byId = numbers.find((n) => n.id === hintPhoneNumberId);
    if (byId) return byId;
  }

  const coexistenceCandidates = numbers.filter(
    (n) => n.isOnBizApp === true && n.platformType === "CLOUD_API"
  );

  if (coexistenceCandidates.length === 1) {
    return coexistenceCandidates[0];
  }

  if (numbers.length === 1) {
    return numbers[0];
  }

  const err = new Error(
    "Could not resolve a unique phone number for coexistence onboarding"
  ) as Error & { statusCode?: number };
  err.statusCode = 400;
  throw err;
}

export async function validateCoexistencePhone(
  phoneNumberId: string,
  accessToken: string
): Promise<{ isOnBizApp: boolean; platformType: string }> {
  const info = await getPhoneNumberInfo(phoneNumberId, accessToken);
  if (!info.isOnBizApp || info.platformType !== "CLOUD_API") {
    const err = new Error(
      "Phone number is not registered for WhatsApp Business App coexistence"
    ) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  return {
    isOnBizApp: info.isOnBizApp,
    platformType: info.platformType ?? "CLOUD_API",
  };
}

export async function completeEmbeddedSignup(params: {
  tenantId: string;
  environment: string;
  code: string;
  wabaId: string;
  phoneNumberId?: string;
  pin?: string;
  appId: string;
  appSecret: string;
  platformAppSecret: string;
}): Promise<{
  phoneNumberId?: string;
  whatsappBusinessAccountId: string;
  needsRegistration: boolean;
}> {
  const {
    tenantId,
    environment,
    code,
    wabaId,
    phoneNumberId,
    pin,
    appId,
    appSecret,
    platformAppSecret,
  } = params;

  const accessToken = await exchangeCodeForToken(code, appId, appSecret);

  await saveTenantWhatsAppSecret(tenantId, environment, {
    accessToken,
    appSecret: platformAppSecret,
  });

  await subscribeWabaWebhooks(wabaId, accessToken);

  let resolvedPhoneId = phoneNumberId?.trim() || undefined;
  if (!resolvedPhoneId) {
    const numbers = await listWabaPhoneNumbers(wabaId, accessToken);
    const resolved = resolveCloudApiPhoneNumber(numbers, phoneNumberId);
    resolvedPhoneId = resolved?.id;
  }

  if (!resolvedPhoneId) {
    return {
      whatsappBusinessAccountId: wabaId,
      needsRegistration: false,
    };
  }

  assertDistinctWabaAndPhone(wabaId, resolvedPhoneId);
  const phoneInfo = await getPhoneNumberInfo(resolvedPhoneId, accessToken);

  if (isPhoneAlreadyRegisteredForCloudApi(phoneInfo)) {
    return {
      phoneNumberId: resolvedPhoneId,
      whatsappBusinessAccountId: wabaId,
      needsRegistration: false,
    };
  }

  if (pin && /^\d{6}$/.test(pin)) {
    await registerPhoneNumber(resolvedPhoneId, accessToken, pin);
    return {
      phoneNumberId: resolvedPhoneId,
      whatsappBusinessAccountId: wabaId,
      needsRegistration: false,
    };
  }

  return {
    phoneNumberId: resolvedPhoneId,
    whatsappBusinessAccountId: wabaId,
    needsRegistration: true,
  };
}

export async function completeCoexistenceSignup(params: {
  tenantId: string;
  environment: string;
  code: string;
  wabaId: string;
  phoneNumberId?: string;
  appId: string;
  appSecret: string;
  platformAppSecret: string;
}): Promise<{
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  isOnBizApp: boolean;
  platformType: string;
}> {
  const { tenantId, environment, code, wabaId, phoneNumberId, appId, appSecret, platformAppSecret } =
    params;

  const accessToken = await exchangeCodeForToken(code, appId, appSecret);

  await saveTenantWhatsAppSecret(tenantId, environment, {
    accessToken,
    appSecret: platformAppSecret,
  });

  await subscribeWabaWebhooks(wabaId, accessToken, COEXISTENCE_WEBHOOK_FIELDS);

  const numbers = await listWabaPhoneNumbers(wabaId, accessToken);
  if (!numbers.length) {
    const err = new Error("No phone numbers found for this WhatsApp Business account") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  const resolved = resolveCoexistencePhoneNumber(numbers, phoneNumberId);
  assertDistinctWabaAndPhone(wabaId, resolved.id);

  const coexistence = await validateCoexistencePhone(resolved.id, accessToken);

  return {
    phoneNumberId: resolved.id,
    whatsappBusinessAccountId: wabaId,
    isOnBizApp: coexistence.isOnBizApp,
    platformType: coexistence.platformType,
  };
}

async function validateTokenForPhone(
  phoneNumberId: string,
  accessToken: string
): Promise<WhatsAppPhoneInfo> {
  try {
    return await getPhoneNumberInfo(phoneNumberId, accessToken);
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
      const err = new Error(
        "Access token does not have permission for this phone number ID"
      ) as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    throw error;
  }
}

function isPhoneAlreadyRegisteredForCloudApi(phoneInfo: WhatsAppPhoneInfo): boolean {
  if (phoneInfo.isOnBizApp === true) return true;
  return phoneInfo.status?.toUpperCase() === "CONNECTED";
}

export async function completeManualConnect(params: {
  tenantId: string;
  environment: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  pin: string;
  platformAppSecret: string;
}): Promise<{ phoneNumberId: string; whatsappBusinessAccountId: string }> {
  const { tenantId, environment, accessToken, wabaId, phoneNumberId, pin, platformAppSecret } =
    params;

  assertDistinctWabaAndPhone(wabaId, phoneNumberId);
  const phoneInfo = await validateTokenForPhone(phoneNumberId, accessToken);

  await saveTenantWhatsAppSecret(tenantId, environment, {
    accessToken,
    appSecret: platformAppSecret,
  });

  await subscribeWabaWebhooks(wabaId, accessToken);
  if (!isPhoneAlreadyRegisteredForCloudApi(phoneInfo)) {
    await registerPhoneNumber(phoneNumberId, accessToken, pin);
  }

  return {
    phoneNumberId,
    whatsappBusinessAccountId: wabaId,
  };
}
