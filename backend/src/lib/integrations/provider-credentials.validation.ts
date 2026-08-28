import type {
  DeepgramCredentialPayload,
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

function sanitizeTelnyxApiKey(apiKey: string): string {
  let key = apiKey.trim();
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, "").trim();
  }
  return key;
}

async function readTelnyxError(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      errors?: Array<{ title?: string; detail?: string; code?: string }>;
    };
    const first = body.errors?.[0];
    if (!first) return undefined;
    return [first.title, first.detail].filter(Boolean).join(": ") || first.code;
  } catch {
    return undefined;
  }
}

async function assertTelnyxApiKey(apiKey: string): Promise<void> {
  const probes = ["/balance", "/phone_numbers?page[size]=1"];
  let sawForbidden = false;
  let lastDetail: string | undefined;

  for (const path of probes) {
    const response = await fetch(`https://api.telnyx.com/v2${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (response.ok) return;

    if (response.status === 401) {
      throw Object.assign(new Error("Invalid Telnyx API key"), { statusCode: 400 });
    }

    if (response.status === 403) {
      sawForbidden = true;
      lastDetail = (await readTelnyxError(response)) ?? lastDetail;
      continue;
    }

    lastDetail = (await readTelnyxError(response)) ?? `HTTP ${response.status}`;
  }

  if (sawForbidden) return;

  throw Object.assign(new Error(lastDetail ?? "Invalid Telnyx API key"), { statusCode: 400 });
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

async function assertDeepgramKey(apiKey: string): Promise<void> {
  const response = await fetch("https://api.deepgram.com/v1/projects", {
    headers: {
      Authorization: `Token ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error("Invalid Deepgram API key"), { statusCode: 400 });
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
  credentialConnectionId?: string;
  publicKey?: string;
}): Pick<TelnyxCredentialPayload, "apiKey"> & Partial<TelnyxCredentialPayload> {
  const apiKey = sanitizeTelnyxApiKey(body.apiKey ?? "");
  const connectionId = (body.connectionId ?? "").trim();
  const credentialConnectionId = (body.credentialConnectionId ?? "").trim();
  const publicKey = (body.publicKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) {
    throw Object.assign(new Error("Telnyx apiKey is required"), { statusCode: 400 });
  }
  return {
    apiKey,
    ...(connectionId ? { connectionId } : {}),
    ...(credentialConnectionId ? { credentialConnectionId } : {}),
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

export function normalizeDeepgramPayload(body: { apiKey?: string }): DeepgramCredentialPayload {
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) {
    throw Object.assign(new Error("Deepgram apiKey is required"), { statusCode: 400 });
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
  if (provider === "deepgram") {
    await assertDeepgramKey((payload as DeepgramCredentialPayload).apiKey);
    return;
  }
  await assertElevenLabsKey((payload as ElevenLabsCredentialPayload).apiKey);
}
