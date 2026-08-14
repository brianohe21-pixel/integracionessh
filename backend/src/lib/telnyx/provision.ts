import type { TelnyxCredentialPayload } from "../integrations/provider-credentials.js";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

interface CallControlApplication {
  id: string;
  application_name?: string;
  webhook_event_url?: string;
  webhook_api_version?: string;
}

interface OutboundVoiceProfile {
  id: string;
  name?: string;
  enabled?: boolean;
}

export function buildTelnyxWebhookUrl(tenantId: string, apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/$/, "");
  return `${base}/telephony/webhook/${tenantId}`;
}

export function buildTelnyxAppName(tenantId: string): string {
  return `integracionessh-${tenantId}`;
}

export function buildTelnyxOutboundProfileName(tenantId: string): string {
  return `integracionessh-${tenantId}`;
}

export function buildTelnyxCredentialConnectionName(tenantId: string): string {
  return `integracionessh-${tenantId}-webrtc`;
}

function buildCallControlApplicationPayload(
  applicationName: string,
  webhookUrl: string,
  outboundVoiceProfileId: string
): Record<string, unknown> {
  return {
    application_name: applicationName,
    webhook_event_url: webhookUrl,
    webhook_api_version: "2",
    active: true,
    outbound: {
      outbound_voice_profile_id: outboundVoiceProfileId,
    },
  };
}

async function telnyxRequest<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${TELNYX_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" && data && "errors" in data
        ? JSON.stringify((data as { errors: unknown }).errors)
        : text;
    throw Object.assign(new Error(`Telnyx API error (${response.status}): ${detail}`), {
      statusCode: response.status >= 500 ? 502 : 400,
    });
  }

  return data as T;
}

async function listOutboundVoiceProfiles(apiKey: string): Promise<OutboundVoiceProfile[]> {
  const data = await telnyxRequest<{ data?: OutboundVoiceProfile[] }>(
    apiKey,
    "/outbound_voice_profiles?page[size]=100",
    { method: "GET" }
  );
  return data.data ?? [];
}

async function createOutboundVoiceProfile(
  apiKey: string,
  name: string
): Promise<OutboundVoiceProfile> {
  const data = await telnyxRequest<{ data: OutboundVoiceProfile }>(
    apiKey,
    "/outbound_voice_profiles",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        enabled: true,
      }),
    }
  );
  return data.data;
}

export async function ensureTelnyxOutboundVoiceProfile(params: {
  apiKey: string;
  tenantId: string;
}): Promise<{ outboundVoiceProfileId: string }> {
  const profiles = await listOutboundVoiceProfiles(params.apiKey);
  const enabledProfiles = profiles.filter((profile) => profile.enabled !== false);
  if (enabledProfiles.length > 0) {
    return { outboundVoiceProfileId: enabledProfiles[0].id };
  }

  const profileName = buildTelnyxOutboundProfileName(params.tenantId);
  const existing = profiles.find((profile) => profile.name === profileName);
  if (existing) {
    return { outboundVoiceProfileId: existing.id };
  }

  const created = await createOutboundVoiceProfile(params.apiKey, profileName);
  return { outboundVoiceProfileId: created.id };
}

async function listCallControlApplications(apiKey: string): Promise<CallControlApplication[]> {
  const data = await telnyxRequest<{ data?: CallControlApplication[] }>(
    apiKey,
    "/call_control_applications?page[size]=100",
    { method: "GET" }
  );
  return data.data ?? [];
}

async function createCallControlApplication(
  apiKey: string,
  applicationName: string,
  webhookUrl: string,
  outboundVoiceProfileId: string
): Promise<CallControlApplication> {
  const data = await telnyxRequest<{ data: CallControlApplication }>(
    apiKey,
    "/call_control_applications",
    {
      method: "POST",
      body: JSON.stringify(
        buildCallControlApplicationPayload(applicationName, webhookUrl, outboundVoiceProfileId)
      ),
    }
  );
  return data.data;
}

async function updateCallControlApplication(
  apiKey: string,
  applicationId: string,
  applicationName: string,
  webhookUrl: string,
  outboundVoiceProfileId: string
): Promise<CallControlApplication> {
  const data = await telnyxRequest<{ data: CallControlApplication }>(
    apiKey,
    `/call_control_applications/${encodeURIComponent(applicationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(
        buildCallControlApplicationPayload(applicationName, webhookUrl, outboundVoiceProfileId)
      ),
    }
  );
  return data.data;
}

export async function ensureTelnyxCallControlApp(params: {
  apiKey: string;
  tenantId: string;
  apiBaseUrl: string;
  existingConnectionId?: string;
}): Promise<{ connectionId: string }> {
  const webhookUrl = buildTelnyxWebhookUrl(params.tenantId, params.apiBaseUrl);
  if (!params.apiBaseUrl.trim()) {
    throw Object.assign(
      new Error(
        "API base URL is not configured. Set API_PUBLIC_URL in the backend environment."
      ),
      { statusCode: 500 }
    );
  }

  const { outboundVoiceProfileId } = await ensureTelnyxOutboundVoiceProfile({
    apiKey: params.apiKey,
    tenantId: params.tenantId,
  });

  const applicationName = buildTelnyxAppName(params.tenantId);
  const apps = await listCallControlApplications(params.apiKey);

  const byExistingId = params.existingConnectionId
    ? apps.find((app) => app.id === params.existingConnectionId)
    : undefined;
  const byName = apps.find((app) => app.application_name === applicationName);
  const target = byExistingId ?? byName;

  if (target) {
    await updateCallControlApplication(
      params.apiKey,
      target.id,
      applicationName,
      webhookUrl,
      outboundVoiceProfileId
    );
    return { connectionId: target.id };
  }

  const created = await createCallControlApplication(
    params.apiKey,
    applicationName,
    webhookUrl,
    outboundVoiceProfileId
  );
  return { connectionId: created.id };
}

export async function assignTelnyxPhoneNumbers(params: {
  apiKey: string;
  connectionId: string;
}): Promise<number> {
  const data = await telnyxRequest<{
    data?: Array<{ id: string; connection_id?: string | null }>;
  }>(params.apiKey, "/phone_numbers?page[size]=100", { method: "GET" });

  let assigned = 0;
  for (const number of data.data ?? []) {
    if (number.connection_id === params.connectionId) continue;
    await telnyxRequest(
      params.apiKey,
      `/phone_numbers/${encodeURIComponent(number.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ connection_id: params.connectionId }),
      }
    );
    assigned += 1;
  }
  return assigned;
}

export async function prepareTelnyxCredentialPayload(params: {
  apiKey: string;
  tenantId: string;
  apiBaseUrl: string;
  connectionId?: string;
  publicKey?: string;
  existing?: TelnyxCredentialPayload | null;
}): Promise<TelnyxCredentialPayload> {
  const existingConnectionId = params.connectionId || params.existing?.connectionId;
  const provisioned = await ensureTelnyxCallControlApp({
    apiKey: params.apiKey,
    tenantId: params.tenantId,
    apiBaseUrl: params.apiBaseUrl,
    ...(existingConnectionId ? { existingConnectionId } : {}),
  });

  await assignTelnyxPhoneNumbers({
    apiKey: params.apiKey,
    connectionId: provisioned.connectionId,
  });

  const credentialConnection = await ensureTelnyxCredentialConnection({
    apiKey: params.apiKey,
    tenantId: params.tenantId,
    apiBaseUrl: params.apiBaseUrl,
    outboundVoiceProfileId: (
      await ensureTelnyxOutboundVoiceProfile({
        apiKey: params.apiKey,
        tenantId: params.tenantId,
      })
    ).outboundVoiceProfileId,
    ...(params.existing?.credentialConnectionId
      ? { existingCredentialConnectionId: params.existing.credentialConnectionId }
      : {}),
  });

  return {
    apiKey: params.apiKey,
    connectionId: provisioned.connectionId,
    credentialConnectionId: credentialConnection.credentialConnectionId,
    ...(params.publicKey
      ? { publicKey: params.publicKey }
      : params.existing?.publicKey
        ? { publicKey: params.existing.publicKey }
        : {}),
  };
}

interface CredentialConnection {
  id: string;
  connection_name?: string;
}

async function listCredentialConnections(apiKey: string): Promise<CredentialConnection[]> {
  const data = await telnyxRequest<{ data?: CredentialConnection[] }>(
    apiKey,
    "/credential_connections?page[size]=100",
    { method: "GET" }
  );
  return data.data ?? [];
}

export async function ensureTelnyxCredentialConnection(params: {
  apiKey: string;
  tenantId: string;
  apiBaseUrl: string;
  outboundVoiceProfileId: string;
  existingCredentialConnectionId?: string;
}): Promise<{ credentialConnectionId: string }> {
  const webhookUrl = buildTelnyxWebhookUrl(params.tenantId, params.apiBaseUrl);
  const connectionName = buildTelnyxCredentialConnectionName(params.tenantId);
  const connections = await listCredentialConnections(params.apiKey);
  const existing =
    (params.existingCredentialConnectionId
      ? connections.find((item) => item.id === params.existingCredentialConnectionId)
      : undefined) ?? connections.find((item) => item.connection_name === connectionName);

  const payload = {
    connection_name: connectionName,
    user_name: `cc${params.tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "tenant"}`,
    password: `Wx${params.tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}Aa1!`,
    webhook_event_url: webhookUrl,
    webhook_api_version: "2",
    outbound: { outbound_voice_profile_id: params.outboundVoiceProfileId },
  };

  if (existing) {
    await telnyxRequest(params.apiKey, `/credential_connections/${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        connection_name: connectionName,
        webhook_event_url: webhookUrl,
        webhook_api_version: "2",
        outbound: { outbound_voice_profile_id: params.outboundVoiceProfileId },
      }),
    });
    return { credentialConnectionId: existing.id };
  }

  const created = await telnyxRequest<{ data: CredentialConnection }>(
    params.apiKey,
    "/credential_connections",
    { method: "POST", body: JSON.stringify(payload) }
  );
  return { credentialConnectionId: created.data.id };
}

export async function createAdvisorTelephonyCredential(params: {
  apiKey: string;
  credentialConnectionId: string;
  name: string;
}): Promise<{ id: string; sipUsername: string; sipPassword: string }> {
  const data = await telnyxRequest<{
    data: { id: string; sip_username?: string; sip_password?: string };
  }>(params.apiKey, "/telephony_credentials", {
    method: "POST",
    body: JSON.stringify({
      connection_id: params.credentialConnectionId,
      name: params.name,
    }),
  });
  return {
    id: data.data.id,
    sipUsername: data.data.sip_username ?? "",
    sipPassword: data.data.sip_password ?? "",
  };
}

export async function createTelephonyCredentialToken(params: {
  apiKey: string;
  credentialId: string;
}): Promise<string> {
  const data = await telnyxRequest<{ data?: string } | string>(
    params.apiKey,
    `/telephony_credentials/${encodeURIComponent(params.credentialId)}/token`,
    { method: "POST" }
  );
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object" && typeof data.data === "string") return data.data;
  throw Object.assign(new Error("Telnyx did not return a WebRTC token"), { statusCode: 502 });
}
