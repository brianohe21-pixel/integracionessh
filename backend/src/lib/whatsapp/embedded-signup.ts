import { getPhoneNumberInfo, registerPhoneNumber } from "./client.js";
import { saveTenantWhatsAppSecret } from "./secrets.js";

const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

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

export async function subscribeWabaWebhooks(wabaId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${GRAPH_API_URL}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscribed_fields: ["messages", "calls"],
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

export async function completeEmbeddedSignup(params: {
  tenantId: string;
  environment: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  pin: string;
  appId: string;
  appSecret: string;
  platformAppSecret: string;
}): Promise<{ phoneNumberId: string; whatsappBusinessAccountId: string }> {
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

  assertDistinctWabaAndPhone(wabaId, phoneNumberId);

  const accessToken = await exchangeCodeForToken(code, appId, appSecret);

  await saveTenantWhatsAppSecret(tenantId, environment, {
    accessToken,
    appSecret: platformAppSecret,
  });

  await subscribeWabaWebhooks(wabaId, accessToken);
  await registerPhoneNumber(phoneNumberId, accessToken, pin);

  return {
    phoneNumberId,
    whatsappBusinessAccountId: wabaId,
  };
}

async function validateTokenForPhone(phoneNumberId: string, accessToken: string): Promise<void> {
  try {
    await getPhoneNumberInfo(phoneNumberId, accessToken);
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
  await validateTokenForPhone(phoneNumberId, accessToken);

  await saveTenantWhatsAppSecret(tenantId, environment, {
    accessToken,
    appSecret: platformAppSecret,
  });

  await subscribeWabaWebhooks(wabaId, accessToken);
  await registerPhoneNumber(phoneNumberId, accessToken, pin);

  return {
    phoneNumberId,
    whatsappBusinessAccountId: wabaId,
  };
}
