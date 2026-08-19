import { randomUUID } from "crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { getBot } from "../dynamodb/bot.repository.js";
import { getOrCreateConversation } from "../dynamodb/conversation.repository.js";
import {
  upsertCallRecord,
  updateCallRecord,
  getCallRecord,
} from "../dynamodb/call.repository.js";
import { appendCallEvent } from "../dynamodb/call-event.repository.js";
import { incrementVoicebotMinutes } from "../dynamodb/usage.repository.js";
import { assertCanStartVoicebotSession } from "../billing/assert-plan.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  answerInboundCall,
  dialOutboundCall,
  directionToWhatsApp,
  hangupCall,
  isTelnyxCallEndedError,
  startCallRecording,
  startCallStreaming,
  stopCallStreaming,
  searchTelnyxDetailRecords,
} from "../telnyx/client.js";
import { normalizeE164 } from "../telnyx/phone.js";
import {
  createTelephonySession,
  endTelephonySession,
  getTelephonySession,
  getTelephonySessionByCallControlId,
  updateTelephonySessionStatus,
  attachTelephonyCallControlId,
} from "./session.repository.js";
import { decodeTelnyxClientState } from "../telnyx/webhook.js";
import {
  shouldConnectOutboundAfterAmd,
  shouldHangupOutboundAfterAmd,
} from "../telnyx/amd.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import {
  buildCallConnectPayload,
  buildCallStatusPayload,
  buildCallTerminatedPayload,
  buildIntegrationPayload,
} from "../integrations/payloads.js";
import { downloadRecordingToS3 } from "./recording.js";
import { directionFromCallRecord, estimateTelephonyCost } from "./cost.js";
import { extractCallStructuredOutputs } from "./structured-output.js";
import {
  resolveTelephonyStructuredOutput,
  wrapStructuredOutputResult,
} from "./structured-output-config.js";
import type {
  BotLocale,
  CallRecord,
  CallUsageMetrics,
  TelephonyCallDirection,
  TelephonySession,
  TelephonyStructuredOutputPayload,
} from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const GATEWAY_WS_URL = process.env.TELEPHONY_GATEWAY_WS_URL ?? "";
const CDR_QUEUE_URL = process.env.TELEPHONY_CDR_SQS_QUEUE_URL ?? "";
const sqs = new SQSClient({});

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

async function logCallEvent(
  tenantId: string,
  botId: string,
  callId: string,
  type: Parameters<typeof appendCallEvent>[0]["type"],
  message?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await appendCallEvent({
    tenantId,
    botId,
    callId,
    type,
    ...(message ? { message } : {}),
    ...(metadata ? { metadata } : {}),
  }).catch(() => undefined);
}

async function queueCdrReconciliation(params: {
  tenantId: string;
  botId: string;
  callId: string;
  callControlId: string;
  attempt?: number;
}): Promise<void> {
  if (!CDR_QUEUE_URL) return;
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: CDR_QUEUE_URL,
      MessageBody: JSON.stringify({
        ...params,
        attempt: params.attempt ?? 1,
        scheduledAt: new Date().toISOString(),
      }),
      MessageGroupId: params.callId,
      MessageDeduplicationId: `${params.callId}-cdr-${params.attempt ?? 1}-${randomUUID()}`,
    })
  );
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
  recordingEnabled?: boolean;
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
    recordingStatus: params.recordingEnabled ? "pending" : "disabled",
    costStatus: "pending",
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

  await createTelephonySession({
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
    tenantId: params.tenantId,
    to,
    from,
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
      recordingEnabled: Boolean(bot.telephonyRecordingEnabled),
    })
  );

  await logCallEvent(params.tenantId, params.botId, callId, "initiated", "Outbound call started");

  return { callId, sessionId, status: "initiated" };
}

async function resolveTelephonySessionFromPayload(
  payload: Record<string, unknown>
): Promise<TelephonySession | null> {
  const callControlId = String(payload.call_control_id ?? "");
  if (callControlId) {
    const session = await getTelephonySessionByCallControlId(callControlId);
    if (session) return session;
  }

  const { sessionId } = decodeTelnyxClientState(payload);
  if (sessionId) {
    return getTelephonySession(sessionId);
  }

  return null;
}

async function finalizeUnansweredOutboundCall(
  session: TelephonySession,
  callControlId: string,
  call: CallRecord | null
): Promise<void> {
  const startedMs = new Date(session.startedAt).getTime();
  const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedMs) / 1000));

  await endTelephonySession(session.sessionId, durationSeconds);

  const bot = await getBot(session.tenantId, session.botId);
  const estimate = estimateTelephonyCost({
    direction: "outbound",
    durationSeconds,
    recordingEnabled: false,
  });

  await updateCallRecord(session.tenantId, session.callId, {
    status: "terminated",
    duration: durationSeconds,
    endedAt: new Date().toISOString(),
    costStatus: estimate.status,
    costBreakdown: estimate.breakdown,
    ...(call?.recordingStatus === "pending"
      ? { recordingStatus: "disabled" as const }
      : call?.recordingStatus
        ? { recordingStatus: call.recordingStatus }
        : {}),
  });

  await logCallEvent(session.tenantId, session.botId, session.callId, "hangup", undefined, {
    durationSeconds,
    reason: "unanswered",
  });
  await logCallEvent(session.tenantId, session.botId, session.callId, "cost_pending");

  await queueCdrReconciliation({
    tenantId: session.tenantId,
    botId: session.botId,
    callId: session.callId,
    callControlId,
  });

  const endedAt = new Date().toISOString();
  const businessPhoneNumber = call?.businessPhoneNumber ?? bot?.telephonyPhoneNumber;

  await emitIntegrationEvent(
    session.tenantId,
    "call.terminated",
    buildCallTerminatedPayload({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      phoneNumber: session.participantId,
      direction: "BUSINESS_INITIATED",
      duration: durationSeconds,
      status: "terminated",
      startedAt: session.startedAt,
      endedAt,
      ...(businessPhoneNumber ? { businessPhoneNumber } : {}),
    })
  );
}

async function finalizeVoicemailCall(
  session: TelephonySession,
  callControlId: string,
  amdResult: string
): Promise<void> {
  if (session.status === "ended") return;

  const call = await getCallRecord(session.tenantId, session.callId);
  if (call?.status === "voicemail") return;

  await logCallEvent(
    session.tenantId,
    session.botId,
    session.callId,
    "voicemail_detected",
    amdResult
  );

  try {
    await stopCallStreaming(ENVIRONMENT, callControlId, session.tenantId).catch(() => undefined);
    await hangupCall(ENVIRONMENT, callControlId, session.tenantId);
  } catch (error) {
    if (!isTelnyxCallEndedError(error)) throw error;
  }

  const startedMs = new Date(session.startedAt).getTime();
  const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedMs) / 1000));

  await endTelephonySession(session.sessionId, durationSeconds);

  const bot = await getBot(session.tenantId, session.botId);
  const estimate = estimateTelephonyCost({
    direction: "outbound",
    durationSeconds,
    recordingEnabled: false,
  });

  await updateCallRecord(session.tenantId, session.callId, {
    status: "voicemail",
    duration: durationSeconds,
    endedAt: new Date().toISOString(),
    costStatus: estimate.status,
    costBreakdown: estimate.breakdown,
    recordingStatus: "disabled",
  });

  await logCallEvent(session.tenantId, session.botId, session.callId, "hangup", undefined, {
    durationSeconds,
    reason: "voicemail",
  });
  await logCallEvent(session.tenantId, session.botId, session.callId, "cost_pending");

  await queueCdrReconciliation({
    tenantId: session.tenantId,
    botId: session.botId,
    callId: session.callId,
    callControlId,
  });

  const endedAt = new Date().toISOString();
  const businessPhoneNumber = call?.businessPhoneNumber ?? bot?.telephonyPhoneNumber;

  await emitIntegrationEvent(
    session.tenantId,
    "call.terminated",
    buildCallTerminatedPayload({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      phoneNumber: session.participantId,
      direction: "BUSINESS_INITIATED",
      duration: durationSeconds,
      status: "voicemail",
      startedAt: session.startedAt,
      endedAt,
      ...(businessPhoneNumber ? { businessPhoneNumber } : {}),
    })
  );
}

async function connectOutboundTelephonyCall(
  session: TelephonySession,
  callControlId: string
): Promise<void> {
  const call = await getCallRecord(session.tenantId, session.callId);
  if (
    call?.status === "accepted" ||
    call?.status === "completed" ||
    call?.status === "voicemail"
  ) {
    return;
  }

  const bot = await getBot(session.tenantId, session.botId);
  if (!bot) return;

  await updateTelephonySessionStatus(session.sessionId, "active");
  await updateCallRecord(session.tenantId, session.callId, {
    status: "accepted",
    startedAt: new Date().toISOString(),
  });

  await logCallEvent(session.tenantId, session.botId, session.callId, "answered");

  await startCallStreaming({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    callControlId,
    streamUrl: gatewayStreamUrl(session.streamToken),
    clientState: encodeClientState({
      sessionId: session.sessionId,
      callId: session.callId,
    }),
  });

  await emitIntegrationEvent(
    session.tenantId,
    "call.status",
    buildCallStatusPayload({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      status: "accepted",
      phoneNumber: session.participantId,
    })
  );

  if (bot.telephonyRecordingEnabled) {
    try {
      await startCallRecording(ENVIRONMENT, callControlId, session.tenantId);
      await updateCallRecord(session.tenantId, session.callId, {
        recordingStatus: "processing",
      });
      await logCallEvent(
        session.tenantId,
        session.botId,
        session.callId,
        "recording_started"
      );
    } catch (error) {
      await updateCallRecord(session.tenantId, session.callId, {
        recordingStatus: "failed",
      });
      await logCallEvent(
        session.tenantId,
        session.botId,
        session.callId,
        "recording_failed",
        error instanceof Error ? error.message : "Recording start failed"
      );
    }
  }
}

async function finalizeTelephonyCallSession(
  session: TelephonySession,
  callControlId: string
): Promise<void> {
  if (session.status === "ended") return;

  const existingCall = await getCallRecord(session.tenantId, session.callId);
  if (existingCall?.status === "voicemail") return;

  const wasConnected =
    existingCall?.status === "accepted" || existingCall?.status === "completed";
  if (session.direction === "outbound" && !wasConnected) {
    await finalizeUnansweredOutboundCall(session, callControlId, existingCall);
    return;
  }

  const bot = await getBot(session.tenantId, session.botId);
  const startedMs = new Date(session.startedAt).getTime();
  const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedMs) / 1000));
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));

  await endTelephonySession(session.sessionId, durationSeconds);

  const call = await getCallRecord(session.tenantId, session.callId);
  const estimate = estimateTelephonyCost({
    direction: session.direction,
    durationSeconds,
    ...(call?.usageMetrics ? { usage: call.usageMetrics } : {}),
    recordingEnabled: Boolean(bot?.telephonyRecordingEnabled),
  });

  let extractedFields: TelephonyStructuredOutputPayload | null = null;
  if (bot && call) {
    const definition = resolveTelephonyStructuredOutput(bot);
    if (definition) {
      const raw = await extractCallStructuredOutputs({
        tenantId: session.tenantId,
        call,
        definition,
        locale: session.locale,
      });
      if (raw) {
        extractedFields = wrapStructuredOutputResult(definition.name, raw);
      }
    }
  }

  await updateCallRecord(session.tenantId, session.callId, {
    status: "completed",
    duration: durationSeconds,
    endedAt: new Date().toISOString(),
    costStatus: estimate.status,
    costBreakdown: estimate.breakdown,
    ...(extractedFields ? { extractedFields } : {}),
  });

  await incrementVoicebotMinutes(session.tenantId, minutes);
  await logCallEvent(session.tenantId, session.botId, session.callId, "hangup", undefined, {
    durationSeconds,
  });
  await logCallEvent(session.tenantId, session.botId, session.callId, "cost_pending");

  await queueCdrReconciliation({
    tenantId: session.tenantId,
    botId: session.botId,
    callId: session.callId,
    callControlId,
  });

  const endedAt = new Date().toISOString();
  const businessPhoneNumber = call?.businessPhoneNumber ?? bot?.telephonyPhoneNumber;

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
      startedAt: session.startedAt,
      endedAt,
      ...(businessPhoneNumber ? { businessPhoneNumber } : {}),
      ...(extractedFields ? { structuredOutputs: extractedFields } : {}),
    })
  );
}

export async function handleOutboundCallRinging(payload: Record<string, unknown>): Promise<void> {
  const session = await resolveTelephonySessionFromPayload(payload);
  if (!session) return;

  const call = await getCallRecord(session.tenantId, session.callId);
  if (!call || call.status !== "initiated") return;

  await updateTelephonySessionStatus(session.sessionId, "ringing");
  await updateCallRecord(session.tenantId, session.callId, { status: "ringing" });
  await logCallEvent(session.tenantId, session.botId, session.callId, "ringing");
}

export async function handleInboundCallInitiated(
  payload: Record<string, unknown>,
  credentialTenantId?: string
): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  const from = normalizeE164(String(payload.from ?? ""));
  const to = normalizeE164(String(payload.to ?? ""));
  if (!callControlId || !from || !to) return;

  const telnyxTenantId = credentialTenantId;

  const lookup = await import("../dynamodb/bot-lookup.repository.js").then((m) =>
    m.getBotByTelephonyNumber(to)
  );
  if (!lookup) {
    await hangupCall(ENVIRONMENT, callControlId, telnyxTenantId).catch(() => undefined);
    return;
  }

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot?.telephonyEnabled || bot.status !== "active") {
    await hangupCall(ENVIRONMENT, callControlId, lookup.tenantId).catch(() => undefined);
    return;
  }

  const { startContactCenterInbound } = await import("../contact-center/service.js");
  const routed = await startContactCenterInbound({
    payload,
    bot,
    tenantId: lookup.tenantId,
  });
  if (routed === "handled") return;

  if (bot.responseMode !== "openai") {
    await hangupCall(ENVIRONMENT, callControlId, lookup.tenantId).catch(() => undefined);
    return;
  }

  const tenant = await getTenant(lookup.tenantId);
  if (!tenant) {
    await hangupCall(ENVIRONMENT, callControlId, lookup.tenantId).catch(() => undefined);
    return;
  }

  try {
    await assertCanStartVoicebotSession(tenant);
  } catch {
    await hangupCall(ENVIRONMENT, callControlId, lookup.tenantId).catch(() => undefined);
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
      recordingEnabled: Boolean(bot.telephonyRecordingEnabled),
    })
  );

  await logCallEvent(lookup.tenantId, lookup.botId, callId, "initiated", "Inbound call received");

  try {
    await answerInboundCall({
      environment: ENVIRONMENT,
      tenantId: lookup.tenantId,
      callControlId,
      streamUrl: gatewayStreamUrl(session.streamToken),
      clientState: encodeClientState({ sessionId, callId }),
    });
  } catch (error) {
    if (!isTelnyxCallEndedError(error)) throw error;
    await endTelephonySession(sessionId, 1);
    await updateCallRecord(lookup.tenantId, callId, {
      status: "completed",
      endedAt: new Date().toISOString(),
      duration: 1,
    });
    await logCallEvent(
      lookup.tenantId,
      lookup.botId,
      callId,
      "hangup",
      "Caller hung up before answer"
    );
    return;
  }

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
  const session = await resolveTelephonySessionFromPayload(payload);
  if (!session) return;

  const bot = await getBot(session.tenantId, session.botId);
  if (!bot) return;

  if (session.direction === "outbound") {
    if (session.mode === "agent") return;
    await connectOutboundTelephonyCall(session, callControlId);
    return;
  }

  await updateTelephonySessionStatus(session.sessionId, "active");
  await updateCallRecord(session.tenantId, session.callId, {
    status: "accepted",
    startedAt: new Date().toISOString(),
  });

  await logCallEvent(session.tenantId, session.botId, session.callId, "answered");

  await emitIntegrationEvent(
    session.tenantId,
    "call.status",
    buildCallStatusPayload({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      status: "accepted",
      phoneNumber: session.participantId,
    })
  );

  if (bot.telephonyRecordingEnabled) {
    try {
      await startCallRecording(ENVIRONMENT, callControlId, session.tenantId);
      await updateCallRecord(session.tenantId, session.callId, {
        recordingStatus: "processing",
      });
      await logCallEvent(
        session.tenantId,
        session.botId,
        session.callId,
        "recording_started"
      );
    } catch (error) {
      await updateCallRecord(session.tenantId, session.callId, {
        recordingStatus: "failed",
      });
      await logCallEvent(
        session.tenantId,
        session.botId,
        session.callId,
        "recording_failed",
        error instanceof Error ? error.message : "Recording start failed"
      );
    }
  }
}

export async function handleMachineDetectionEnded(
  payload: Record<string, unknown>
): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;

  const session = await resolveTelephonySessionFromPayload(payload);
  if (!session || session.direction !== "outbound") return;
  if (session.mode === "agent") return;

  const call = await getCallRecord(session.tenantId, session.callId);
  if (
    call?.status === "completed" ||
    call?.status === "voicemail" ||
    call?.status === "terminated"
  ) {
    return;
  }

  const alreadyConnected = call?.status === "accepted";
  const result = String(payload.result ?? "");
  if (shouldHangupOutboundAfterAmd(result, alreadyConnected)) {
    await finalizeVoicemailCall(session, callControlId, result);
    return;
  }

  if (!alreadyConnected && shouldConnectOutboundAfterAmd(result)) {
    await connectOutboundTelephonyCall(session, callControlId);
  }
}

export async function handleCallRecordingSaved(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;

  const session = await resolveTelephonySessionFromPayload(payload);
  if (!session) return;

  const call = await getCallRecord(session.tenantId, session.callId);
  if (!call) return;

  const recordingUrls = payload.recording_urls as Record<string, string> | undefined;
  const mp3Url = recordingUrls?.mp3 ?? recordingUrls?.wav;
  const recordingId = String(payload.recording_id ?? "");

  if (!mp3Url) {
    await updateCallRecord(session.tenantId, session.callId, { recordingStatus: "failed" });
    await logCallEvent(
      session.tenantId,
      session.botId,
      session.callId,
      "recording_failed",
      "Recording URL missing"
    );
    return;
  }

  try {
    const stored = await downloadRecordingToS3({
      tenantId: session.tenantId,
      botId: session.botId,
      callId: session.callId,
      sourceUrl: mp3Url,
    });

    await updateCallRecord(session.tenantId, session.callId, {
      recordingStatus: "ready",
      recordingS3Key: stored.s3Key,
      ...(recordingId ? { telnyxRecordingId: recordingId } : {}),
      ...(typeof payload.duration_millis === "number"
        ? { recordingDurationSeconds: Math.ceil(payload.duration_millis / 1000) }
        : {}),
    });

    await logCallEvent(session.tenantId, session.botId, session.callId, "recording_saved", undefined, {
      sizeBytes: stored.sizeBytes,
    });

    await emitIntegrationEvent(
      session.tenantId,
      "call.recording.ready",
      buildIntegrationPayload({
        event: "call.recording.ready",
        tenantId: session.tenantId,
        data: {
          botId: session.botId,
          callId: session.callId,
          recordingStatus: "ready",
          durationSeconds:
            typeof payload.duration_millis === "number"
              ? Math.ceil(payload.duration_millis / 1000)
              : call.duration,
        },
      })
    );
  } catch (error) {
    await updateCallRecord(session.tenantId, session.callId, { recordingStatus: "failed" });
    await logCallEvent(
      session.tenantId,
      session.botId,
      session.callId,
      "recording_failed",
      error instanceof Error ? error.message : "Recording storage failed"
    );
  }
}

export async function handleCallHangup(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;
  const session = await resolveTelephonySessionFromPayload(payload);
  if (!session) return;

  const call = await getCallRecord(session.tenantId, session.callId);
  if (call?.status === "voicemail") return;

  await finalizeTelephonyCallSession(session, callControlId);
}

export async function reportCallUsage(params: {
  tenantId: string;
  callId: string;
  usage: CallUsageMetrics;
}): Promise<void> {
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!call) return;

  const bot = await getBot(params.tenantId, call.botId);
  const direction = directionFromCallRecord(call);
  const estimate = estimateTelephonyCost({
    direction,
    durationSeconds: call.duration ?? 1,
    usage: params.usage,
    recordingEnabled: Boolean(bot?.telephonyRecordingEnabled),
    ...(call.costBreakdown?.telnyxUsd !== undefined
      ? { telnyxCostUsd: call.costBreakdown.telnyxUsd }
      : {}),
  });

  await updateCallRecord(params.tenantId, params.callId, {
    usageMetrics: params.usage,
    costStatus: estimate.status,
    costBreakdown: estimate.breakdown,
  });

  if (estimate.status === "final") {
    await logCallEvent(params.tenantId, call.botId, params.callId, "cost_finalized", undefined, {
      totalUsd: estimate.breakdown.totalUsd,
    });
    await emitIntegrationEvent(
      params.tenantId,
      "call.cost.finalized",
      buildIntegrationPayload({
        event: "call.cost.finalized",
        tenantId: params.tenantId,
        data: {
          botId: call.botId,
          callId: params.callId,
          costStatus: estimate.status,
          costBreakdown: estimate.breakdown,
        },
      })
    );
  } else {
    await logCallEvent(params.tenantId, call.botId, params.callId, "cost_partial", undefined, {
      totalUsd: estimate.breakdown.totalUsd,
    });
  }
}

export async function reconcileCallCost(params: {
  tenantId: string;
  botId: string;
  callId: string;
  callControlId: string;
  attempt: number;
}): Promise<{ done: boolean }> {
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!call) return { done: true };

  const bot = await getBot(params.tenantId, params.botId);
  const records = await searchTelnyxDetailRecords(
    ENVIRONMENT,
    params.callControlId,
    params.tenantId
  );
  const telnyxRecord = records[0];
  const telnyxCostUsd = telnyxRecord?.cost ? Number(telnyxRecord.cost) : undefined;
  const resolvedTelnyxCost =
    telnyxCostUsd !== undefined && Number.isFinite(telnyxCostUsd) ? telnyxCostUsd : undefined;

  const direction = directionFromCallRecord(call);
  const estimate = estimateTelephonyCost({
    direction,
    durationSeconds: call.duration ?? telnyxRecord?.durationSecs ?? 1,
    ...(call.usageMetrics ? { usage: call.usageMetrics } : {}),
    recordingEnabled: Boolean(bot?.telephonyRecordingEnabled),
    ...(resolvedTelnyxCost !== undefined ? { telnyxCostUsd: resolvedTelnyxCost } : {}),
  });

  await updateCallRecord(params.tenantId, params.callId, {
    costStatus: estimate.status,
    costBreakdown: estimate.breakdown,
  });

  if (estimate.status === "final") {
    await logCallEvent(params.tenantId, params.botId, params.callId, "cost_finalized", undefined, {
      totalUsd: estimate.breakdown.totalUsd,
      attempt: params.attempt,
    });
    await emitIntegrationEvent(
      params.tenantId,
      "call.cost.finalized",
      buildIntegrationPayload({
        event: "call.cost.finalized",
        tenantId: params.tenantId,
        data: {
          botId: params.botId,
          callId: params.callId,
          costStatus: estimate.status,
          costBreakdown: estimate.breakdown,
        },
      })
    );
    return { done: true };
  }

  if (params.attempt >= 5) {
    await logCallEvent(params.tenantId, params.botId, params.callId, "cost_partial", undefined, {
      attempt: params.attempt,
    });
    return { done: true };
  }

  await queueCdrReconciliation({ ...params, attempt: params.attempt + 1 });
  return { done: false };
}

export async function terminateTelephonyCall(
  tenantId: string,
  callId: string
): Promise<void> {
  const record = await getCallRecord(tenantId, callId);
  if (!record?.callControlId || record.provider !== "telnyx") {
    throw Object.assign(new Error("Call not found"), { statusCode: 404 });
  }
  if (
    record.status === "completed" ||
    record.status === "failed" ||
    record.status === "rejected" ||
    record.status === "terminated" ||
    record.status === "voicemail"
  ) {
    return;
  }

  if (record.callControlId) {
    try {
      await hangupCall(ENVIRONMENT, record.callControlId, tenantId);
    } catch (error) {
      if (!isTelnyxCallEndedError(error)) throw error;
    }
  }

  const session = record.callControlId
    ? await getTelephonySessionByCallControlId(record.callControlId)
    : null;

  if (session && session.status !== "ended") {
    await finalizeTelephonyCallSession(session, record.callControlId);
    return;
  }

  const bot = await getBot(tenantId, record.botId);
  const startedMs = new Date(record.startedAt ?? record.createdAt).getTime();
  const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedMs) / 1000));
  const estimate = estimateTelephonyCost({
    direction: directionFromCallRecord(record),
    durationSeconds,
    ...(record.usageMetrics ? { usage: record.usageMetrics } : {}),
    recordingEnabled: Boolean(bot?.telephonyRecordingEnabled),
  });

  await updateCallRecord(tenantId, callId, {
    status: "completed",
    duration: durationSeconds,
    endedAt: new Date().toISOString(),
    costStatus: estimate.status,
    costBreakdown: estimate.breakdown,
  });
  await logCallEvent(tenantId, record.botId, callId, "hangup", undefined, { durationSeconds });
}
