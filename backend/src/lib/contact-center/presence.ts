import { getTelnyxSecrets } from "../telnyx/secrets.js";
import {
  createAdvisorTelephonyCredential,
  createTelephonyCredentialToken,
  ensureTelnyxCredentialConnection,
  ensureTelnyxOutboundVoiceProfile,
} from "../telnyx/provision.js";
import {
  getAgentPresence,
  putAgentPresence,
  effectivePresenceState,
} from "../dynamodb/agent-presence.repository.js";
import type { AgentPresence, AgentPresenceState } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? "";

export async function ensurePresenceCredential(params: {
  tenantId: string;
  advisorId: string;
  cognitoUserId?: string;
  kind?: "advisor" | "member";
  skills?: string[];
  queueIds?: string[];
}): Promise<AgentPresence> {
  const existing = await getAgentPresence(params.tenantId, params.advisorId);
  if (existing?.telnyxCredentialId && existing.telnyxSipUsername) {
    return existing;
  }

  const secrets = await getTelnyxSecrets(ENVIRONMENT, params.tenantId);
  let credentialConnectionId = secrets.credentialConnectionId;
  if (!credentialConnectionId) {
    const { outboundVoiceProfileId } = await ensureTelnyxOutboundVoiceProfile({
      apiKey: secrets.apiKey,
      tenantId: params.tenantId,
    });
    const created = await ensureTelnyxCredentialConnection({
      apiKey: secrets.apiKey,
      tenantId: params.tenantId,
      apiBaseUrl: API_PUBLIC_URL,
      outboundVoiceProfileId,
    });
    credentialConnectionId = created.credentialConnectionId;
  }

  const credential = await createAdvisorTelephonyCredential({
    apiKey: secrets.apiKey,
    credentialConnectionId,
    name: `${params.kind ?? "advisor"}-${params.advisorId.slice(0, 8)}`,
  });

  const now = new Date().toISOString();
  const presence: AgentPresence = {
    advisorId: params.advisorId,
    tenantId: params.tenantId,
    state: existing?.state ?? "offline",
    skills: params.skills ?? existing?.skills ?? [],
    queueIds: params.queueIds ?? existing?.queueIds ?? [],
    webrtcConnected: existing?.webrtcConnected ?? false,
    lastHeartbeatAt: existing?.lastHeartbeatAt ?? now,
    telnyxSipUsername: credential.sipUsername,
    telnyxCredentialId: credential.id,
    ...(existing?.lastCallAt ? { lastCallAt: existing.lastCallAt } : {}),
    callsHandled: existing?.callsHandled ?? 0,
    kind: params.kind ?? existing?.kind ?? "advisor",
    ...(params.cognitoUserId ? { cognitoUserId: params.cognitoUserId } : {}),
    updatedAt: now,
  };
  return putAgentPresence(presence);
}

export async function issueSoftphoneToken(params: {
  tenantId: string;
  advisorId: string;
}): Promise<{ loginToken: string; sipUsername: string; presence: AgentPresence }> {
  const presence = await ensurePresenceCredential(params);
  if (!presence.telnyxCredentialId) {
    throw Object.assign(new Error("WebRTC credential is not ready"), { statusCode: 500 });
  }
  const secrets = await getTelnyxSecrets(ENVIRONMENT, params.tenantId);
  const loginToken = await createTelephonyCredentialToken({
    apiKey: secrets.apiKey,
    credentialId: presence.telnyxCredentialId,
  });
  return {
    loginToken,
    sipUsername: presence.telnyxSipUsername ?? "",
    presence,
  };
}

export async function updatePresenceState(params: {
  tenantId: string;
  advisorId: string;
  state?: AgentPresenceState;
  webrtcConnected?: boolean;
  skills?: string[];
  queueIds?: string[];
  heartbeat?: boolean;
}): Promise<AgentPresence> {
  const existing =
    (await getAgentPresence(params.tenantId, params.advisorId)) ??
    (await ensurePresenceCredential(params));
  const now = new Date().toISOString();
  let state = params.state ?? effectivePresenceState(existing);
  if (state === "wrap_up" && existing.wrapUpUntil && Date.parse(existing.wrapUpUntil) <= Date.now()) {
    state = "available";
  }
  const { wrapUpUntil: _wrapUpUntil, ...rest } = existing;
  void _wrapUpUntil;
  const updated: AgentPresence = {
    ...rest,
    state,
    ...(params.webrtcConnected !== undefined ? { webrtcConnected: params.webrtcConnected } : {}),
    ...(params.skills ? { skills: params.skills } : {}),
    ...(params.queueIds ? { queueIds: params.queueIds } : {}),
    lastHeartbeatAt: params.heartbeat === false ? existing.lastHeartbeatAt : now,
    updatedAt: now,
    ...(state === "wrap_up" && existing.wrapUpUntil ? { wrapUpUntil: existing.wrapUpUntil } : {}),
  };
  return putAgentPresence(updated);
}

export async function markAgentOffered(params: {
  tenantId: string;
  advisorId: string;
}): Promise<void> {
  const existing = await getAgentPresence(params.tenantId, params.advisorId);
  if (!existing) return;
  await putAgentPresence({
    ...existing,
    state: "ringing",
    updatedAt: new Date().toISOString(),
  });
}

export async function markAgentOnCall(params: {
  tenantId: string;
  advisorId: string;
}): Promise<void> {
  const existing = await getAgentPresence(params.tenantId, params.advisorId);
  if (!existing) return;
  const now = new Date().toISOString();
  await putAgentPresence({
    ...existing,
    state: "on_call",
    lastCallAt: now,
    callsHandled: (existing.callsHandled ?? 0) + 1,
    updatedAt: now,
  });
}

export async function markAgentWrapUp(params: {
  tenantId: string;
  advisorId: string;
  wrapUpSeconds?: number;
}): Promise<void> {
  const existing = await getAgentPresence(params.tenantId, params.advisorId);
  if (!existing) return;
  const seconds = params.wrapUpSeconds ?? 30;
  const now = Date.now();
  await putAgentPresence({
    ...existing,
    state: "wrap_up",
    wrapUpUntil: new Date(now + seconds * 1000).toISOString(),
    lastHeartbeatAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  });
}
