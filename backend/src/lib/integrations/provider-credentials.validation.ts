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

async function assertTelnyxApiKey(apiKey: string): Promise<void> {
  const response = await fetch("https://api.telnyx.com/v2/phone_numbers?page[size]=1", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error("Invalid Telnyx API key"), { statusCode: 400 });
  }
}

export async function assertTelnyxApiKeyValid(apiKey: string): Promise<void> {
  await assertTelnyxApiKey(apiKey);
}

async function readElevenLabsError(
  response: Response
): Promise<{ status?: string; message?: string } | undefined> {
  try {
    const body = (await response.json()) as {
      detail?: { status?: string; message?: string };
    };
    return body.detail;
  } catch {
    return undefined;
  }
}

async function assertElevenLabsKey(apiKey: string): Promise<void> {
  const probes = [
    "https://api.elevenlabs.io/v1/models",
    "https://api.elevenlabs.io/v1/voices",
    "https://api.elevenlabs.io/v1/user",
  ];

  let sawForbidden = false;
  let lastMessage: string | undefined;

  for (const url of probes) {
    const response = await fetch(url, {
      headers: {
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
    });
    if (response.ok) return;

    const detail = await readElevenLabsError(response);
    lastMessage = detail?.message;

    if (detail?.status === "quota_exceeded") return;

    if (response.status === 403) {
      sawForbidden = true;
      continue;
    }
  }

  if (sawForbidden) {
    throw Object.assign(
      new Error(
        "ElevenLabs API key rejected. Disable IP allowlist or allow Models/Voices access for this key."
      ),
      { statusCode: 400 }
    );
  }

  throw Object.assign(new Error(lastMessage ?? "Invalid ElevenLabs API key"), { statusCode: 400 });
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
}): Pick<TelnyxCredentialPayload, "apiKey"> & Partial<TelnyxCredentialPayload> {
  const apiKey = (body.apiKey ?? "").trim();
  const connectionId = (body.connectionId ?? "").trim();
  const publicKey = (body.publicKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) {
    throw Object.assign(new Error("Telnyx apiKey is required"), { statusCode: 400 });
  }
  return {
    apiKey,
    ...(connectionId ? { connectionId } : {}),
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
    await assertTelnyxApiKey((payload as TelnyxCredentialPayload).apiKey);
    return;
  }
  await assertElevenLabsKey((payload as ElevenLabsCredentialPayload).apiKey);
}
