import type {
  ElevenLabsCredentialPayload,
  OpenAICredentialPayload,
  ProviderId,
  ProviderPayloadMap,
  TelnyxCredentialPayload,
} from "./provider-credentials.js";

async function assertOpenAIKey(apiKey: string): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error("Invalid OpenAI API key"), { statusCode: 400 });
  }
}

async function assertTelnyxCredentials(payload: TelnyxCredentialPayload): Promise<void> {
  const response = await fetch("https://api.telnyx.com/v2/phone_numbers?page[size]=1", {
    headers: {
      Authorization: `Bearer ${payload.apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error("Invalid Telnyx API key"), { statusCode: 400 });
  }
  if (!payload.connectionId.trim()) {
    throw Object.assign(new Error("Telnyx connectionId is required"), { statusCode: 400 });
  }
}

async function assertElevenLabsKey(apiKey: string): Promise<void> {
  const response = await fetch("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": apiKey },
  });
  if (!response.ok) {
    throw Object.assign(new Error("Invalid ElevenLabs API key"), { statusCode: 400 });
  }
}

export function normalizeOpenAIPayload(body: { apiKey?: string }): OpenAICredentialPayload {
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
    throw Object.assign(new Error("Invalid OpenAI API key format"), { statusCode: 400 });
  }
  return { apiKey };
}

export function normalizeTelnyxPayload(body: {
  apiKey?: string;
  connectionId?: string;
  publicKey?: string;
}): TelnyxCredentialPayload {
  const apiKey = (body.apiKey ?? "").trim();
  const connectionId = (body.connectionId ?? "").trim();
  const publicKey = (body.publicKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) {
    throw Object.assign(new Error("Telnyx apiKey is required"), { statusCode: 400 });
  }
  if (!connectionId) {
    throw Object.assign(new Error("Telnyx connectionId is required"), { statusCode: 400 });
  }
  return {
    apiKey,
    connectionId,
    ...(publicKey ? { publicKey } : {}),
  };
}

export function normalizeElevenLabsPayload(body: { apiKey?: string }): ElevenLabsCredentialPayload {
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) {
    throw Object.assign(new Error("ElevenLabs apiKey is required"), { statusCode: 400 });
  }
  return { apiKey };
}

export async function validateProviderCredential<P extends ProviderId>(
  provider: P,
  payload: ProviderPayloadMap[P]
): Promise<void> {
  if (provider === "openai") {
    await assertOpenAIKey((payload as OpenAICredentialPayload).apiKey);
    return;
  }
  if (provider === "telnyx") {
    await assertTelnyxCredentials(payload as TelnyxCredentialPayload);
    return;
  }
  await assertElevenLabsKey((payload as ElevenLabsCredentialPayload).apiKey);
}
