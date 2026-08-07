import { randomUUID } from "crypto";
import { getBot } from "../dynamodb/bot.repository.js";
import { getOrCreateConversation } from "../dynamodb/conversation.repository.js";
import { upsertCallRecord, updateCallRecordStatus } from "../dynamodb/call.repository.js";
import { incrementVoicebotMinutes } from "../dynamodb/usage.repository.js";
import { assertCanStartVoicebotSession } from "../billing/assert-plan.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  answerInboundCall,
  dialOutboundCall,
  directionToWhatsApp,
  hangupCall,
} from "../telnyx/client.js";
import { normalizeE164 } from "../telnyx/phone.js";
import {
  createTelephonySession,
  endTelephonySession,
  getTelephonySessionByCallControlId,
  updateTelephonySessionStatus,
  attachTelephonyCallControlId,
} from "./session.repository.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import {
  buildCallConnectPayload,
  buildCallTerminatedPayload,
} from "../integrations/payloads.js";
import type { BotLocale, CallRecord, TelephonyCallDirection } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const GATEWAY_WS_URL = process.env.TELEPHONY_GATEWAY_WS_URL ?? "";

function gatewayStreamUrl(streamToken: string): string {
  const base = GATEWAY_WS_URL.replace(/\/$/, "");
  if (!base) {
    throw Object.assign(new Error("Telephony gateway is not configured"), { statusCode: 503 });
  }
  return `${base}/stream?token=${encodeURIComponent(streamToken)}`;
}

function encodeClientState(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

export function buildTelephonyCallRecord(params: {
  callId: string;
  tenantId: string;
  botId: string;
  phoneNumber: string;
  businessPhoneNumber: string;
  direction: TelephonyCallDirection;
  callControlId: string;
  conversationId?: string;
  status?: CallRecord["status"];
}): CallRecord {
  const now = new Date().toISOString();
  return {
    callId: params.callId,
    tenantId: params.tenantId,
    botId: params.botId,
    phoneNumber: params.phoneNumber,
    businessPhoneNumber: params.businessPhoneNumber,
    direction: directionToWhatsApp(params.direction),
    status: params.status ?? "ringing",
    provider: "telnyx",
    channel: "phone",
    callControlId: params.callControlId,
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    createdAt: now,
    updatedAt: now,
    startedAt: now,
  };
}

export async function startOutboundTelephonyCall(params: {
  tenantId: string;
  botId: string;
  to: string;
  contactName?: string;
}): Promise<{ callId: string; sessionId: string; status: string }> {
  const to = normalizeE164(params.to);
  if (!to) {
    throw Object.assign(new Error("Invalid destination phone number"), { statusCode: 400 });
  }

  const bot = await getBot(params.tenantId, params.botId);
  if (!bot || !bot.telephonyEnabled || !bot.telephonyPhoneNumber) {
    throw Object.assign(new Error("Telephony is not enabled for this bot"), { statusCode: 400 });
  }
  if (bot.responseMode !== "openai") {
    throw Object.assign(new Error("Telephony requires OpenAI response mode"), { statusCode: 400 });
  }

  const tenant = await getTenant(params.tenantId);
  if (!tenant) throw Object.assign(new Error("Tenant not found"), { statusCode: 404 });
  await assertCanStartVoicebotSession(tenant);

  const from = normalizeE164(bot.telephonyPhoneNumber);
  const locale: BotLocale = bot.defaultLocale ?? "es";
  const callId = randomUUID();
  const sessionId = randomUUID();
  const participantId = to;

  const conversation = await getOrCreateConversation(
    params.tenantId,
    params.botId,
    "phone",
    participantId,
    params.contactName
  );

  const session = await createTelephonySession({
    sessionId,
    callControlId: "pending",
    callId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: conversation.conversationId,
    participantId,
    direction: "outbound",
    fromNumber: from,
    toNumber: to,
    locale,
    ...(params.contactName ? { contactName: params.contactName } : {}),
  });

  const dial = await dialOutboundCall({
    environment: ENVIRONMENT,
    to,
    from,
    streamUrl: gatewayStreamUrl(session.streamToken),
    clientState: encodeClientState({ sessionId, callId }),
  });

  await attachTelephonyCallControlId(sessionId, dial.callControlId);

  await upsertCallRecord(
    buildTelephonyCallRecord({
      callId,
      tenantId: params.tenantId,
      botId: params.botId,
      phoneNumber: to,
      businessPhoneNumber: from,
      direction: "outbound",
      callControlId: dial.callControlId,
      conversationId: conversation.conversationId,
      status: "initiated",
    })
  );

  return { callId, sessionId, status: "initiated" };
}

export async function handleInboundCallInitiated(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  const from = normalizeE164(String(payload.from ?? ""));
  const to = normalizeE164(String(payload.to ?? ""));
  if (!callControlId || !from || !to) return;

  const lookup = await import("../dynamodb/bot-lookup.repository.js").then((m) =>
    m.getBotByTelephonyNumber(to)
  );
  if (!lookup) {
    await hangupCall(ENVIRONMENT, callControlId).catch(() => undefined);
    return;
  }

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot?.telephonyEnabled || bot.status !== "active" || bot.responseMode !== "openai") {
    await hangupCall(ENVIRONMENT, callControlId).catch(() => undefined);
    return;
  }

  const tenant = await getTenant(lookup.tenantId);
  if (!tenant) {
    await hangupCall(ENVIRONMENT, callControlId).catch(() => undefined);
    return;
  }

  try {
    await assertCanStartVoicebotSession(tenant);
  } catch {
    await hangupCall(ENVIRONMENT, callControlId).catch(() => undefined);
    return;
  }

  const locale: BotLocale = bot.defaultLocale ?? "es";
  const callId = randomUUID();
  const sessionId = randomUUID();

  const conversation = await getOrCreateConversation(
    lookup.tenantId,
    lookup.botId,
    "phone",
    from
  );

  const session = await createTelephonySession({
    sessionId,
    callControlId,
    callId,
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    conversationId: conversation.conversationId,
    participantId: from,
    direction: "inbound",
    fromNumber: from,
    toNumber: to,
    locale,
  });

  await upsertCallRecord(
    buildTelephonyCallRecord({
      callId,
      tenantId: lookup.tenantId,
      botId: lookup.botId,
      phoneNumber: from,
      businessPhoneNumber: to,
      direction: "inbound",
      callControlId,
      conversationId: conversation.conversationId,
    })
  );

  await answerInboundCall({
    environment: ENVIRONMENT,
    callControlId,
    streamUrl: gatewayStreamUrl(session.streamToken),
    clientState: encodeClientState({ sessionId, callId }),
  });

  await emitIntegrationEvent(
    lookup.tenantId,
    "call.connect",
    buildCallConnectPayload({
      tenantId: lookup.tenantId,
      botId: lookup.botId,
      callId,
      direction: "USER_INITIATED",
      from,
      to,
    })
  );
}

export async function handleCallAnswered(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;
  const session = await getTelephonySessionByCallControlId(callControlId);
  if (!session) return;

  await updateTelephonySessionStatus(session.sessionId, "active");
  await updateCallRecordStatus(session.tenantId, session.callId, {
    status: "accepted",
    startedAt: new Date().toISOString(),
  });
}

export async function handleCallHangup(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;
  const session = await getTelephonySessionByCallControlId(callControlId);
  if (!session || session.status === "ended") return;

  const startedMs = new Date(session.startedAt).getTime();
  const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedMs) / 1000));
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));

  await endTelephonySession(session.sessionId, durationSeconds);
  await updateCallRecordStatus(session.tenantId, session.callId, {
    status: "completed",
    duration: durationSeconds,
    endedAt: new Date().toISOString(),
  });
  await incrementVoicebotMinutes(session.tenantId, minutes);

  await emitIntegrationEvent(
    session.tenantId,
    "call.terminated",
    buildCallTerminatedPayload({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      phoneNumber: session.participantId,
      direction: session.direction === "inbound" ? "USER_INITIATED" : "BUSINESS_INITIATED",
      duration: durationSeconds,
      status: "completed",
    })
  );
}

export async function terminateTelephonyCall(
  tenantId: string,
  callId: string
): Promise<void> {
  const { getCallRecord } = await import("../dynamodb/call.repository.js");
  const record = await getCallRecord(tenantId, callId);
  if (!record?.callControlId || record.provider !== "telnyx") {
    throw Object.assign(new Error("Call not found"), { statusCode: 404 });
  }
  await hangupCall(ENVIRONMENT, record.callControlId);
}
