import { randomUUID } from "crypto";
import type {
  Bot,
  BotLocale,
  ContactCenterQueue,
  QueueFallbackAction,
  QueueMembership,
  SupervisorRole,
  TelephonySession,
  VoiceCampaignAttempt,
} from "../../types/index.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getOrCreateConversation } from "../dynamodb/conversation.repository.js";
import { getCallRecord, updateCallRecord, upsertCallRecord } from "../dynamodb/call.repository.js";
import { appendCallEvent } from "../dynamodb/call-event.repository.js";
import {
  getContactCenterQueue,
  listContactCenterQueues,
} from "../dynamodb/contact-center-queue.repository.js";
import { getContactCenterIvrFlow } from "../dynamodb/contact-center-ivr.repository.js";
import {
  deleteQueueMembership,
  enqueueQueueMembership,
  getQueueMembershipByCallId,
  listQueueMemberships,
} from "../dynamodb/queue-membership.repository.js";
import {
  getAgentPresence,
  listAgentPresence,
  putAgentPresence,
} from "../dynamodb/agent-presence.repository.js";
import {
  listRunningVoiceCampaigns,
  putVoiceCampaign,
  putVoiceCampaignAttempt,
} from "../dynamodb/voice-campaign.repository.js";
import {
  answerCall,
  answerInboundCall,
  createConference,
  dialCall,
  gatherUsingSpeak,
  hangupCall,
  holdConferenceParticipant,
  isTelnyxCallEndedError,
  joinConference,
  leaveConference,
  speakOnCall,
  startCallRecording,
  startCallStreaming,
  startPlayback,
  stopCallStreaming,
  stopPlayback,
  unholdConferenceParticipant,
} from "../telnyx/client.js";
import { getTelnyxSecrets } from "../telnyx/secrets.js";
import { normalizeE164 } from "../telnyx/phone.js";
import { decodeTelnyxClientState } from "../telnyx/webhook.js";
import {
  attachTelephonyCallControlId,
  clearContactCenterPhase,
  clearTelephonySupervisor,
  indexTelephonyCallControlId,
  createTelephonySession,
  getTelephonySession,
  getTelephonySessionByCallControlId,
  patchTelephonySession,
  updateTelephonySessionStatus,
} from "../telephony/session.repository.js";
import { buildTelephonyCallRecord } from "../telephony/service.js";
import { pickAgentForQueue, queuePosition } from "./acd.js";
import { isWithinBusinessHours } from "./hours.js";
import {
  findIvrNode,
  gatherDigitsForNode,
  resolveBotRoutingMode,
  resolveIvrDigit,
} from "./routing.js";
import { markAgentOffered, markAgentOnCall, markAgentWrapUp } from "./presence.js";
import { nextCampaignRecipient } from "./campaigns.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const GATEWAY_WS_URL = process.env.TELEPHONY_GATEWAY_WS_URL ?? "";

function encodeClientState(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

const SUPERVISOR_ROLES = new Set<SupervisorRole>(["monitor", "whisper", "barge"]);

function resolveSupervisorRole(
  sessionRole?: SupervisorRole,
  clientStateRole?: string
): SupervisorRole {
  if (sessionRole && SUPERVISOR_ROLES.has(sessionRole)) return sessionRole;
  if (clientStateRole && SUPERVISOR_ROLES.has(clientStateRole as SupervisorRole)) {
    return clientStateRole as SupervisorRole;
  }
  return "monitor";
}

function gatewayStreamUrl(streamToken: string): string {
  const base = GATEWAY_WS_URL.replace(/\/$/, "");
  if (!base) {
    throw Object.assign(new Error("Telephony gateway is not configured"), { statusCode: 503 });
  }
  return `${base}/stream?token=${encodeURIComponent(streamToken)}`;
}

function speakLanguage(locale: BotLocale): string {
  return locale === "en" ? "en-US" : "es-ES";
}

const CALLBACK_GATHER_DIGIT = "9";
const CALLBACK_QUEUE_PRIORITY = 10;

async function startVoicemailPrompt(session: TelephonySession, prompt?: string): Promise<void> {
  await patchTelephonySession(session.sessionId, { contactCenterPhase: "voicemail_prompt" });
  await updateCallRecord(session.tenantId, session.callId, { status: "voicemail" }).catch(
    () => undefined
  );
  await speakOnCall({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    callControlId: session.callControlId,
    payload:
      prompt ||
      (session.locale === "en"
        ? "Please leave a message after the tone"
        : "Deje su mensaje después del tono"),
    language: speakLanguage(session.locale),
  });
}

async function beginVoicemailRecording(session: TelephonySession): Promise<void> {
  await patchTelephonySession(session.sessionId, { contactCenterPhase: "voicemail_recording" });
  await startCallRecording(ENVIRONMENT, session.callControlId, session.tenantId, {
    playBeep: true,
  }).catch(() => undefined);
  await logEvent(session.tenantId, session.botId, session.callId, "recording_started");
}

async function applyQueueFallbackAction(
  session: TelephonySession,
  queue: ContactCenterQueue,
  action: QueueFallbackAction
): Promise<void> {
  if (action === "ai") {
    await connectSessionToAi(session);
    return;
  }
  if (action === "voicemail") {
    await startVoicemailPrompt(
      session,
      session.locale === "en"
        ? "We are currently closed. Please leave a message after the tone."
        : "En este momento estamos cerrados. Deje su mensaje después del tono."
    );
    return;
  }
  if (action === "callback") {
    await scheduleCallback(session, queue, { afterHours: true });
    return;
  }
  await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
}

async function scheduleCallback(
  session: TelephonySession,
  queue: ContactCenterQueue,
  options?: { afterHours?: boolean; phoneNumber?: string }
): Promise<void> {
  const callbackNumber = normalizeE164(options?.phoneNumber || session.fromNumber);
  if (!callbackNumber) {
    await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
    return;
  }

  const existing = await getQueueMembershipByCallId(session.callId);
  if (existing) await deleteQueueMembership(existing);

  const queuedAt = new Date().toISOString();
  await enqueueQueueMembership({
    membershipId: randomUUID(),
    tenantId: session.tenantId,
    queueId: queue.queueId,
    callId: session.callId,
    sessionId: session.sessionId,
    botId: session.botId,
    priority: options?.afterHours ? CALLBACK_QUEUE_PRIORITY : 0,
    queuedAt,
    callbackNumber,
  });
  await patchTelephonySession(session.sessionId, {
    mode: "queue",
    queueId: queue.queueId,
    contactCenterPhase: "callback_queued",
  });
  await updateCallRecord(session.tenantId, session.callId, {
    queueId: queue.queueId,
    contactCenterMode: "queue",
  });
  await logEvent(session.tenantId, session.botId, session.callId, "callback", callbackNumber);

  const message = options?.afterHours
    ? session.locale === "en"
      ? "We are currently closed. We will call you back during business hours. Goodbye."
      : "En este momento estamos cerrados. Le devolveremos la llamada en horario de atención. Hasta luego."
    : session.locale === "en"
      ? "We will call you back shortly. Goodbye."
      : "Le devolveremos la llamada en breve. Hasta luego.";

  await speakOnCall({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    callControlId: session.callControlId,
    payload: message,
    language: speakLanguage(session.locale),
  });
}

async function offerCallbackGather(session: TelephonySession): Promise<void> {
  await patchTelephonySession(session.sessionId, { contactCenterPhase: "callback_offer" });
  await gatherUsingSpeak({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    callControlId: session.callControlId,
    payload:
      session.locale === "en"
        ? `Press ${CALLBACK_GATHER_DIGIT} to receive a callback instead of waiting.`
        : `Marque ${CALLBACK_GATHER_DIGIT} para recibir una devolución de llamada.`,
    validDigits: CALLBACK_GATHER_DIGIT,
    timeoutMillis: 8000,
    language: speakLanguage(session.locale),
  });
}

async function offerCallbackToAgent(params: {
  membership: QueueMembership;
  session: TelephonySession;
  queue: ContactCenterQueue;
  advisorId: string;
}): Promise<void> {
  const bot = await getBot(params.session.tenantId, params.session.botId);
  const from = normalizeE164(bot?.telephonyPhoneNumber ?? params.session.toNumber);
  const to = normalizeE164(params.membership.callbackNumber ?? "");
  if (!from || !to) {
    await deleteQueueMembership(params.membership);
    return;
  }

  const secrets = await getTelnyxSecrets(ENVIRONMENT, params.session.tenantId);
  const dial = await dialCall({
    environment: ENVIRONMENT,
    tenantId: params.session.tenantId,
    to,
    from,
    connectionId: secrets.connectionId,
    clientState: encodeClientState({
      sessionId: params.session.sessionId,
      callId: params.session.callId,
      leg: "customer",
      advisorId: params.advisorId,
    }),
    timeoutSecs: 30,
  });

  await attachTelephonyCallControlId(params.session.sessionId, dial.callControlId);
  await clearContactCenterPhase(params.session.sessionId);
  await patchTelephonySession(params.session.sessionId, {
    mode: "agent",
    advisorId: params.advisorId,
    direction: "outbound",
    queueId: params.queue.queueId,
  });
  await updateCallRecord(params.session.tenantId, params.session.callId, {
    status: "ringing",
    advisorId: params.advisorId,
    contactCenterMode: "agent",
  });
  await markAgentOffered({ tenantId: params.session.tenantId, advisorId: params.advisorId });
  await logEvent(
    params.session.tenantId,
    params.session.botId,
    params.session.callId,
    "callback",
    to
  );
}

async function logEvent(
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
  });
}

export async function startContactCenterInbound(params: {
  payload: Record<string, unknown>;
  bot: Bot;
  tenantId: string;
}): Promise<"ai" | "handled"> {
  const mode = resolveBotRoutingMode(params.bot);
  if (mode === "ai") return "ai";

  const callControlId = String(params.payload.call_control_id ?? "");
  const from = normalizeE164(String(params.payload.from ?? ""));
  const to = normalizeE164(String(params.payload.to ?? ""));
  if (!callControlId || !from || !to) return "handled";

  const locale: BotLocale = params.bot.defaultLocale ?? "es";
  const callId = randomUUID();
  const sessionId = randomUUID();
  const conversation = await getOrCreateConversation(
    params.tenantId,
    params.bot.botId,
    "phone",
    from
  );

  const session = await createTelephonySession({
    sessionId,
    callControlId,
    callId,
    tenantId: params.tenantId,
    botId: params.bot.botId,
    conversationId: conversation.conversationId,
    participantId: from,
    direction: "inbound",
    fromNumber: from,
    toNumber: to,
    locale,
    mode: mode === "ivr" ? "ivr" : "queue",
    ...(mode === "queue" && params.bot.telephonyQueueId
      ? { queueId: params.bot.telephonyQueueId }
      : {}),
    ...(mode === "ivr" && params.bot.telephonyIvrFlowId
      ? { ivrFlowId: params.bot.telephonyIvrFlowId }
      : {}),
  });

  await upsertCallRecord(
    buildTelephonyCallRecord({
      callId,
      tenantId: params.tenantId,
      botId: params.bot.botId,
      phoneNumber: from,
      businessPhoneNumber: to,
      direction: "inbound",
      callControlId,
      conversationId: conversation.conversationId,
      recordingEnabled: Boolean(params.bot.telephonyRecordingEnabled),
    })
  );
  await updateCallRecord(params.tenantId, callId, {
    ...(session.mode ? { contactCenterMode: session.mode } : {}),
    ...(session.queueId ? { queueId: session.queueId } : {}),
  });
  await logEvent(params.tenantId, params.bot.botId, callId, "initiated", "Contact center inbound");

  await answerCall({
    environment: ENVIRONMENT,
    tenantId: params.tenantId,
    callControlId,
    clientState: encodeClientState({ sessionId, callId }),
  });

  if (params.bot.telephonyRecordingEnabled) {
    await startCallRecording(ENVIRONMENT, callControlId, params.tenantId).catch(() => undefined);
  }

  if (mode === "ivr") {
    await startIvrNode(session);
    return "handled";
  }

  if (params.bot.telephonyQueueId) {
    await enqueueCall({ session, queueId: params.bot.telephonyQueueId });
  }
  return "handled";
}

export async function startIvrNode(session: TelephonySession, nodeId?: string): Promise<void> {
  if (!session.ivrFlowId) return;
  const flow = await getContactCenterIvrFlow(session.tenantId, session.ivrFlowId);
  if (!flow) {
    await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
    return;
  }
  const node = findIvrNode(flow, nodeId);
  if (!node) {
    await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
    return;
  }
  await patchTelephonySession(session.sessionId, { ivrNodeId: node.nodeId, mode: "ivr" });
  const language = speakLanguage(session.locale);

  if (node.type === "menu") {
    await gatherUsingSpeak({
      environment: ENVIRONMENT,
      tenantId: session.tenantId,
      callControlId: session.callControlId,
      payload:
        node.prompt ||
        (session.locale === "en" ? "Please make a selection" : "Seleccione una opción"),
      validDigits: gatherDigitsForNode(node),
      timeoutMillis: (node.timeoutSeconds ?? 8) * 1000,
      language,
    });
    return;
  }

  if (node.type === "queue" && node.queueId) {
    await enqueueCall({ session: { ...session, ivrNodeId: node.nodeId }, queueId: node.queueId });
    return;
  }

  if (node.type === "ai") {
    await connectSessionToAi(session);
    return;
  }

  if (node.type === "voicemail") {
    await startVoicemailPrompt(session, node.prompt);
    return;
  }

  await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
}

export async function handleGatherEnded(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;
  const session = await getTelephonySessionByCallControlId(callControlId);
  if (!session) return;
  const digits = String(payload.digits ?? payload.dtmf ?? "");

  if (
    session.mode === "queue" &&
    session.contactCenterPhase === "callback_offer" &&
    session.queueId
  ) {
    await logEvent(session.tenantId, session.botId, session.callId, "dtmf", digits || "timeout");
    const queue = await getContactCenterQueue(session.tenantId, session.queueId);
    if (!queue) return;
    if (digits === CALLBACK_GATHER_DIGIT) {
      await scheduleCallback(session, queue);
      return;
    }
    await clearContactCenterPhase(session.sessionId);
    await playHold(session, queue);
    return;
  }

  if (!session.ivrFlowId || !session.ivrNodeId) return;
  await logEvent(session.tenantId, session.botId, session.callId, "dtmf", digits || "timeout");

  const flow = await getContactCenterIvrFlow(session.tenantId, session.ivrFlowId);
  const node = flow ? findIvrNode(flow, session.ivrNodeId) : undefined;
  if (!flow || !node) return;

  const resolved = digits ? resolveIvrDigit(node, digits) : null;
  if (!resolved) {
    await startIvrNode(session, node.nodeId);
    return;
  }

  if (resolved.targetType === "queue" && resolved.targetId) {
    await enqueueCall({ session, queueId: resolved.targetId });
    return;
  }
  if (resolved.targetType === "ai") {
    await connectSessionToAi(session);
    return;
  }
  if (resolved.targetType === "menu" && resolved.targetId) {
    await startIvrNode(session, resolved.targetId);
    return;
  }
  if (resolved.targetType === "voicemail") {
    await startIvrNode(session, resolved.targetId);
    return;
  }
  await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
}

export async function connectSessionToAi(session: TelephonySession): Promise<void> {
  await patchTelephonySession(session.sessionId, { mode: "ai" });
  await updateCallRecord(session.tenantId, session.callId, { contactCenterMode: "ai" });
  try {
    await answerInboundCall({
      environment: ENVIRONMENT,
      tenantId: session.tenantId,
      callControlId: session.callControlId,
      streamUrl: gatewayStreamUrl(session.streamToken),
      clientState: encodeClientState({ sessionId: session.sessionId, callId: session.callId }),
    });
  } catch (error) {
    if (isTelnyxCallEndedError(error)) return;
    await startCallStreaming({
      environment: ENVIRONMENT,
      tenantId: session.tenantId,
      callControlId: session.callControlId,
      streamUrl: gatewayStreamUrl(session.streamToken),
      clientState: encodeClientState({ sessionId: session.sessionId, callId: session.callId }),
    }).catch(() => undefined);
  }
}

export async function enqueueCall(params: {
  session: TelephonySession;
  queueId: string;
  priority?: number;
  callbackNumber?: string;
}): Promise<void> {
  const queue = await getContactCenterQueue(params.session.tenantId, params.queueId);
  if (!queue) {
    await hangupCall(ENVIRONMENT, params.session.callControlId, params.session.tenantId).catch(
      () => undefined
    );
    return;
  }

  if (!isWithinBusinessHours(queue.hours)) {
    await handleAfterHours(params.session, queue);
    return;
  }

  const queuedAt = new Date().toISOString();
  const expiresAt = queue.maxWaitSeconds
    ? new Date(Date.now() + queue.maxWaitSeconds * 1000).toISOString()
    : undefined;
  await enqueueQueueMembership({
    membershipId: randomUUID(),
    tenantId: params.session.tenantId,
    queueId: queue.queueId,
    callId: params.session.callId,
    sessionId: params.session.sessionId,
    botId: params.session.botId,
    priority: params.priority ?? 0,
    queuedAt,
    ...(params.callbackNumber ? { callbackNumber: params.callbackNumber } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  });
  await patchTelephonySession(params.session.sessionId, {
    mode: "queue",
    queueId: queue.queueId,
  });
  await updateCallRecord(params.session.tenantId, params.session.callId, {
    queueId: queue.queueId,
    contactCenterMode: "queue",
  });
  await logEvent(params.session.tenantId, params.session.botId, params.session.callId, "queued");
  await playHold(params.session, queue);
  await dispatchQueue(params.session.tenantId, queue.queueId);
}

async function handleAfterHours(session: TelephonySession, queue: ContactCenterQueue): Promise<void> {
  await applyQueueFallbackAction(session, queue, queue.afterHoursAction);
}

async function playHold(session: TelephonySession, queue: ContactCenterQueue): Promise<void> {
  if (queue.holdAudioUrl) {
    await startPlayback({
      environment: ENVIRONMENT,
      tenantId: session.tenantId,
      callControlId: session.callControlId,
      audioUrl: queue.holdAudioUrl,
      loop: true,
    });
    return;
  }
  const waiting = await listQueueMemberships(session.tenantId, queue.queueId);
  const membership = waiting.find((item) => item.callId === session.callId);
  const position = membership
    ? queuePosition(
        membership.queuedAt,
        waiting.map((item) => item.queuedAt)
      )
    : waiting.length;
  const message =
    queue.announcePosition && session.locale === "en"
      ? `Please wait. You are number ${position} in line.`
      : queue.announcePosition
        ? `Espere en línea. Usted es el número ${position} en la cola.`
        : session.locale === "en"
          ? "Please wait. An agent will be with you shortly."
          : "Espere en línea. Un asesor le atenderá en breve.";
  await speakOnCall({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    callControlId: session.callControlId,
    payload: message,
    language: speakLanguage(session.locale),
  });
}

export async function handleSpeakEnded(payload: Record<string, unknown>): Promise<void> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return;
  const session = await getTelephonySessionByCallControlId(callControlId);
  if (!session) return;

  if (session.contactCenterPhase === "voicemail_prompt") {
    await beginVoicemailRecording(session);
    return;
  }

  if (session.contactCenterPhase === "callback_queued") {
    await clearContactCenterPhase(session.sessionId);
    await patchTelephonySession(session.sessionId, { status: "ended" });
    await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
    if (session.queueId) await dispatchQueue(session.tenantId, session.queueId);
    return;
  }

  if (!session.queueId || session.mode !== "queue" || session.advisorId) return;
  const queue = await getContactCenterQueue(session.tenantId, session.queueId);
  if (!queue) return;
  if (queue.callbackEnabled) {
    await offerCallbackGather(session);
    return;
  }
  await playHold(session, queue);
}

export async function dispatchQueue(tenantId: string, queueId: string): Promise<void> {
  const queue = await getContactCenterQueue(tenantId, queueId);
  if (!queue) return;
  const waiting = (await listQueueMemberships(tenantId, queueId)).sort(
    (a, b) => a.priority - b.priority || a.queuedAt.localeCompare(b.queuedAt)
  );
  const now = Date.now();
  for (const membership of waiting) {
    if (membership.expiresAt && Date.parse(membership.expiresAt) <= now) {
      await overflowOrHangup(membership, queue);
      continue;
    }
    const agents = await listAgentPresence(tenantId);
    const agent = pickAgentForQueue(agents, queue);
    if (!agent) {
      if (waiting.length > 0) return;
      await tryDialNextCampaignRecipient(tenantId);
      return;
    }
    const session = await getTelephonySession(membership.sessionId);
    if (!session) {
      await deleteQueueMembership(membership);
      continue;
    }
    if (membership.callbackNumber && !isWithinBusinessHours(queue.hours)) {
      continue;
    }
    if (membership.callbackNumber) {
      await offerCallbackToAgent({ membership, session, queue, advisorId: agent.advisorId });
      return;
    }
    if (session.status === "ended") {
      await deleteQueueMembership(membership);
      continue;
    }
    await offerCallToAgent({ session, queue, advisorId: agent.advisorId });
    return;
  }
  if (waiting.length === 0) {
    await tryDialNextCampaignRecipient(tenantId);
  }
}

async function overflowOrHangup(
  membership: Awaited<ReturnType<typeof listQueueMemberships>>[number],
  queue: ContactCenterQueue
): Promise<void> {
  const session = await getTelephonySession(membership.sessionId);
  await deleteQueueMembership(membership);
  if (!session) return;
  await logEvent(session.tenantId, session.botId, session.callId, "overflow");
  if (queue.overflowQueueId) {
    await enqueueCall({ session, queueId: queue.overflowQueueId });
    return;
  }
  await applyQueueFallbackAction(session, queue, queue.overflowAction ?? "hangup");
}

async function offerCallToAgent(params: {
  session: TelephonySession;
  queue: ContactCenterQueue;
  advisorId: string;
}): Promise<void> {
  const presence = await getAgentPresence(params.session.tenantId, params.advisorId);
  if (!presence?.telnyxSipUsername) return;

  const membership = await getQueueMembershipByCallId(params.session.callId);
  if (membership) await deleteQueueMembership(membership);

  await stopPlayback(ENVIRONMENT, params.session.callControlId, params.session.tenantId).catch(
    () => undefined
  );

  const { conferenceId } = await createConference({
    environment: ENVIRONMENT,
    tenantId: params.session.tenantId,
    callControlId: params.session.callControlId,
    name: `cc-${params.session.callId}`,
  });

  const secrets = await getTelnyxSecrets(ENVIRONMENT, params.session.tenantId);
  const dial = await dialCall({
    environment: ENVIRONMENT,
    tenantId: params.session.tenantId,
    to: `sip:${presence.telnyxSipUsername}@sip.telnyx.com`,
    from: params.session.toNumber,
    connectionId: secrets.connectionId,
    clientState: encodeClientState({
      sessionId: params.session.sessionId,
      callId: params.session.callId,
      leg: "agent",
    }),
    timeoutSecs: 25,
  });

  await patchTelephonySession(params.session.sessionId, {
    mode: "agent",
    conferenceId,
    advisorId: params.advisorId,
    agentCallControlId: dial.callControlId,
    queueId: params.queue.queueId,
  });
  await indexTelephonyCallControlId(params.session.sessionId, dial.callControlId).catch(
    () => undefined
  );
  await updateCallRecord(params.session.tenantId, params.session.callId, {
    advisorId: params.advisorId,
    conferenceId,
    contactCenterMode: "agent",
  });
  await markAgentOffered({ tenantId: params.session.tenantId, advisorId: params.advisorId });
  await logEvent(
    params.session.tenantId,
    params.session.botId,
    params.session.callId,
    "offered",
    undefined,
    { advisorId: params.advisorId }
  );
}

async function resolveContactCenterSession(
  payload: Record<string, unknown>
): Promise<TelephonySession | null> {
  const callControlId = String(payload.call_control_id ?? "");
  if (callControlId) {
    const session = await getTelephonySessionByCallControlId(callControlId);
    if (session) return session;
  }
  const { sessionId } = decodeTelnyxClientState(payload);
  if (sessionId) return getTelephonySession(sessionId);
  return null;
}

export async function handleAgentLegAnswered(payload: Record<string, unknown>): Promise<boolean> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return false;
  const session = await resolveContactCenterSession(payload);
  if (!session) return false;

  if (
    session.direction === "outbound" &&
    session.mode === "agent" &&
    session.callControlId === callControlId &&
    !session.conferenceId
  ) {
    const { leg } = decodeTelnyxClientState(payload);
    if (leg === "webrtc") return false;
    return handleOutboundCustomerAnswered(payload);
  }

  if (!session.conferenceId) return false;
  if (
    session.agentCallControlId !== callControlId &&
    session.supervisorCallControlId !== callControlId
  ) {
    return false;
  }

  const isSupervisorLeg = session.supervisorCallControlId === callControlId;
  const supervisorRole = isSupervisorLeg
    ? resolveSupervisorRole(session.supervisorRole, decodeTelnyxClientState(payload).role)
    : "none";
  await joinConference({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    conferenceId: session.conferenceId,
    callControlId,
    supervisorRole,
  });
  if (session.agentCallControlId === callControlId && session.advisorId) {
    const membership = await getQueueMembershipByCallId(session.callId);
    if (membership) await deleteQueueMembership(membership);
    await markAgentOnCall({ tenantId: session.tenantId, advisorId: session.advisorId });
    await logEvent(session.tenantId, session.botId, session.callId, "agent_answered");
    const queuedAt = (await getCallRecord(session.tenantId, session.callId))?.createdAt;
    const waitSeconds = queuedAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(queuedAt)) / 1000))
      : 0;
    await updateCallRecord(session.tenantId, session.callId, {
      status: "accepted",
      waitSeconds,
      startedAt: new Date().toISOString(),
    });
  }
  return true;
}

export async function handleContactCenterHangup(payload: Record<string, unknown>): Promise<boolean> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return false;
  const session = await resolveContactCenterSession(payload);
  if (!session?.mode || session.mode === "ai") return false;

  if (session.supervisorCallControlId === callControlId) {
    await clearTelephonySupervisor(session.sessionId);
    return true;
  }

  const membership = await getQueueMembershipByCallId(session.callId);
  if (membership && !membership.callbackNumber) {
    await deleteQueueMembership(membership);
  }
  if (
    session.contactCenterPhase === "voicemail_prompt" ||
    session.contactCenterPhase === "voicemail_recording"
  ) {
    await updateCallRecord(session.tenantId, session.callId, { status: "voicemail" }).catch(
      () => undefined
    );
  }
  if (session.direction === "outbound" && membership?.callbackNumber) {
    await deleteQueueMembership(membership);
    if (session.queueId) await dispatchQueue(session.tenantId, session.queueId);
  }
  if (session.advisorId) {
    const queue = session.queueId
      ? await getContactCenterQueue(session.tenantId, session.queueId)
      : null;
    await markAgentWrapUp({
      tenantId: session.tenantId,
      advisorId: session.advisorId,
      wrapUpSeconds: queue?.wrapUpSeconds ?? 30,
    });
  }
  if (session.agentCallControlId && session.agentCallControlId !== callControlId) {
    await hangupCall(ENVIRONMENT, session.agentCallControlId, session.tenantId).catch(
      () => undefined
    );
  }
  if (session.callControlId !== callControlId) {
    await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
  }
  await logEvent(session.tenantId, session.botId, session.callId, "wrap_up");
  if (session.queueId) await dispatchQueue(session.tenantId, session.queueId);
  return false;
}

export async function transferCallToQueue(params: {
  tenantId: string;
  callId: string;
  targetQueueId?: string;
  targetAdvisorId?: string;
  warm?: boolean;
}): Promise<void> {
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!call?.callControlId) {
    throw Object.assign(new Error("Call not found"), { statusCode: 404 });
  }
  const session = await getTelephonySessionByCallControlId(call.callControlId);
  if (!session?.conferenceId) {
    throw Object.assign(new Error("Call is not in a conference"), { statusCode: 400 });
  }

  if (params.warm) {
    await holdConferenceParticipant({
      environment: ENVIRONMENT,
      tenantId: params.tenantId,
      conferenceId: session.conferenceId,
      callControlId: session.callControlId,
    });
  } else if (session.advisorId && session.agentCallControlId) {
    await leaveConference({
      environment: ENVIRONMENT,
      tenantId: params.tenantId,
      conferenceId: session.conferenceId,
      callControlId: session.agentCallControlId,
    }).catch(() => undefined);
    await hangupCall(ENVIRONMENT, session.agentCallControlId, params.tenantId).catch(() => undefined);
    const queue = session.queueId
      ? await getContactCenterQueue(params.tenantId, session.queueId)
      : null;
    await markAgentWrapUp({
      tenantId: params.tenantId,
      advisorId: session.advisorId,
      wrapUpSeconds: queue?.wrapUpSeconds ?? 15,
    });
  }

  if (params.targetAdvisorId) {
    const queue = session.queueId
      ? await getContactCenterQueue(params.tenantId, session.queueId)
      : null;
    if (queue) await offerCallToAgent({ session, queue, advisorId: params.targetAdvisorId });
  } else if (params.targetQueueId) {
    await enqueueCall({ session, queueId: params.targetQueueId });
  }
  await logEvent(params.tenantId, session.botId, params.callId, "transferred");
}

export async function completeWarmTransfer(params: {
  tenantId: string;
  callId: string;
}): Promise<void> {
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!call?.callControlId) throw Object.assign(new Error("Call not found"), { statusCode: 404 });
  const session = await getTelephonySessionByCallControlId(call.callControlId);
  if (!session?.conferenceId) return;
  await unholdConferenceParticipant({
    environment: ENVIRONMENT,
    tenantId: params.tenantId,
    conferenceId: session.conferenceId,
    callControlId: session.callControlId,
  });
  if (session.consultCallControlId) {
    await hangupCall(ENVIRONMENT, session.consultCallControlId, params.tenantId).catch(
      () => undefined
    );
  }
}

export async function superviseCall(params: {
  tenantId: string;
  callId: string;
  supervisorId: string;
  role: SupervisorRole;
}): Promise<void> {
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!call?.callControlId || !call.conferenceId) {
    throw Object.assign(new Error("Live call not found"), { statusCode: 404 });
  }
  const session = await getTelephonySessionByCallControlId(call.callControlId);
  if (!session?.conferenceId) {
    throw Object.assign(new Error("Call is not in a conference"), { statusCode: 400 });
  }
  const presence = await getAgentPresence(params.tenantId, params.supervisorId);
  if (!presence?.telnyxSipUsername) {
    throw Object.assign(new Error("Supervisor softphone is not registered"), { statusCode: 400 });
  }
  const secrets = await getTelnyxSecrets(ENVIRONMENT, params.tenantId);
  const dial = await dialCall({
    environment: ENVIRONMENT,
    tenantId: params.tenantId,
    to: `sip:${presence.telnyxSipUsername}@sip.telnyx.com`,
    from: session.toNumber,
    connectionId: secrets.connectionId,
    clientState: encodeClientState({
      sessionId: session.sessionId,
      callId: session.callId,
      leg: "supervisor",
      role: params.role,
    }),
  });
  await patchTelephonySession(session.sessionId, {
    supervisorCallControlId: dial.callControlId,
    supervisorRole: params.role,
  });
  await indexTelephonyCallControlId(session.sessionId, dial.callControlId).catch(() => undefined);
  await logEvent(params.tenantId, session.botId, params.callId, "supervised", params.role, {
    supervisorId: params.supervisorId,
  });
}

export async function holdLiveCall(params: {
  tenantId: string;
  callId: string;
  hold: boolean;
}): Promise<void> {
  const call = await getCallRecord(params.tenantId, params.callId);
  const session = call?.callControlId
    ? await getTelephonySessionByCallControlId(call.callControlId)
    : null;
  if (!session?.conferenceId) {
    throw Object.assign(new Error("Call is not in a conference"), { statusCode: 400 });
  }
  const action = params.hold ? holdConferenceParticipant : unholdConferenceParticipant;
  await action({
    environment: ENVIRONMENT,
    tenantId: params.tenantId,
    conferenceId: session.conferenceId,
    callControlId: session.callControlId,
  });
}

export async function enqueueFromAiHandoff(params: {
  tenantId: string;
  botId: string;
  callId: string;
}): Promise<boolean> {
  const bot = await getBot(params.tenantId, params.botId);
  const call = await getCallRecord(params.tenantId, params.callId);
  if (!bot || !call?.callControlId) return false;
  const session = await getTelephonySessionByCallControlId(call.callControlId);
  if (!session) return false;
  await stopCallStreaming(ENVIRONMENT, session.callControlId, params.tenantId).catch(() => undefined);
  let queueId = bot.telephonyQueueId;
  if (!queueId) {
    const queues = await listContactCenterQueues(params.tenantId, params.botId);
    queueId = queues[0]?.queueId;
  }
  if (!queueId) return false;
  await enqueueCall({ session, queueId });
  return true;
}

export async function requestCallback(params: {
  tenantId: string;
  callId: string;
  phoneNumber?: string;
}): Promise<void> {
  const call = await getCallRecord(params.tenantId, params.callId);
  const session = call?.callControlId
    ? await getTelephonySessionByCallControlId(call.callControlId)
    : null;
  if (!session?.queueId) {
    throw Object.assign(new Error("Call is not queued"), { statusCode: 400 });
  }
  const queue = await getContactCenterQueue(params.tenantId, session.queueId);
  if (!queue) {
    throw Object.assign(new Error("Queue not found"), { statusCode: 404 });
  }
  await stopPlayback(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
  await scheduleCallback(session, queue, {
    ...(params.phoneNumber ? { phoneNumber: params.phoneNumber } : {}),
  });
}

export async function handleContactCenterRecordingSaved(
  payload: Record<string, unknown>
): Promise<boolean> {
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return false;
  const session = await getTelephonySessionByCallControlId(callControlId);
  if (!session || session.contactCenterPhase !== "voicemail_recording") return false;
  await clearContactCenterPhase(session.sessionId);
  await updateCallRecord(session.tenantId, session.callId, { status: "voicemail" });
  await hangupCall(ENVIRONMENT, session.callControlId, session.tenantId).catch(() => undefined);
  return true;
}


export async function setCallDisposition(params: {
  tenantId: string;
  callId: string;
  disposition: string;
}): Promise<void> {
  await updateCallRecord(params.tenantId, params.callId, { disposition: params.disposition });
}

export async function startPreviewOutbound(params: {
  tenantId: string;
  botId: string;
  advisorId: string;
  to: string;
  campaignId?: string;
}): Promise<{ callId: string }> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot?.telephonyPhoneNumber) {
    throw Object.assign(new Error("Bot has no telephony number"), { statusCode: 400 });
  }
  const to = normalizeE164(params.to);
  if (!to) throw Object.assign(new Error("Invalid destination"), { statusCode: 400 });
  const from = normalizeE164(bot.telephonyPhoneNumber);
  const callId = randomUUID();
  const sessionId = randomUUID();
  const conversation = await getOrCreateConversation(params.tenantId, params.botId, "phone", to);
  const locale: BotLocale = bot.defaultLocale ?? "es";
  await createTelephonySession({
    sessionId,
    callControlId: "pending",
    callId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: conversation.conversationId,
    participantId: to,
    direction: "outbound",
    fromNumber: from,
    toNumber: to,
    locale,
    mode: "agent",
    advisorId: params.advisorId,
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
  });
  await upsertCallRecord({
    ...buildTelephonyCallRecord({
      callId,
      tenantId: params.tenantId,
      botId: params.botId,
      phoneNumber: to,
      businessPhoneNumber: from,
      direction: "outbound",
      callControlId: "pending",
      conversationId: conversation.conversationId,
      recordingEnabled: Boolean(bot.telephonyRecordingEnabled),
    }),
    advisorId: params.advisorId,
    contactCenterMode: "agent",
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
  });

  const presence = await getAgentPresence(params.tenantId, params.advisorId);
  if (!presence?.telnyxSipUsername) {
    throw Object.assign(new Error("Agent softphone is not registered"), { statusCode: 400 });
  }
  const secrets = await getTelnyxSecrets(ENVIRONMENT, params.tenantId);
  const customerDial = await dialCall({
    environment: ENVIRONMENT,
    tenantId: params.tenantId,
    to,
    from,
    connectionId: secrets.connectionId,
    clientState: encodeClientState({ sessionId, callId, leg: "customer" }),
  });
  await attachTelephonyCallControlId(sessionId, customerDial.callControlId);
  await updateCallRecord(params.tenantId, callId, { status: "ringing" });
  await logEvent(params.tenantId, params.botId, callId, "initiated", "Preview outbound");
  return { callId };
}

export async function prepareWebrtcOutbound(params: {
  tenantId: string;
  botId: string;
  advisorId: string;
  to: string;
}): Promise<{ callId: string; clientState: string; callerNumber: string }> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot?.telephonyPhoneNumber) {
    throw Object.assign(new Error("Bot has no telephony number"), { statusCode: 400 });
  }
  const to = normalizeE164(params.to);
  if (!to) throw Object.assign(new Error("Invalid destination"), { statusCode: 400 });
  const from = normalizeE164(bot.telephonyPhoneNumber);
  const callId = randomUUID();
  const sessionId = randomUUID();
  const conversation = await getOrCreateConversation(params.tenantId, params.botId, "phone", to);
  const locale: BotLocale = bot.defaultLocale ?? "es";
  const clientState = encodeClientState({ sessionId, callId, leg: "webrtc" });

  await createTelephonySession({
    sessionId,
    callControlId: "pending",
    callId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: conversation.conversationId,
    participantId: to,
    direction: "outbound",
    fromNumber: from,
    toNumber: to,
    locale,
    mode: "agent",
    advisorId: params.advisorId,
  });
  await upsertCallRecord({
    ...buildTelephonyCallRecord({
      callId,
      tenantId: params.tenantId,
      botId: params.botId,
      phoneNumber: to,
      businessPhoneNumber: from,
      direction: "outbound",
      callControlId: "pending",
      conversationId: conversation.conversationId,
      recordingEnabled: Boolean(bot.telephonyRecordingEnabled),
    }),
    advisorId: params.advisorId,
    contactCenterMode: "agent",
  });
  await markAgentOffered({ tenantId: params.tenantId, advisorId: params.advisorId });
  await logEvent(params.tenantId, params.botId, callId, "initiated", "WebRTC outbound");
  return { callId, clientState, callerNumber: from };
}

export async function handleWebrtcOutboundInitiated(
  payload: Record<string, unknown>
): Promise<boolean> {
  const { sessionId, leg } = decodeTelnyxClientState(payload);
  if (leg !== "webrtc" || !sessionId) return false;
  const session = await getTelephonySession(sessionId);
  if (!session || session.callControlId !== "pending") return false;
  const callControlId = String(payload.call_control_id ?? "");
  if (!callControlId) return false;
  await attachTelephonyCallControlId(sessionId, callControlId);
  await updateCallRecord(session.tenantId, session.callId, { callControlId, status: "ringing" });
  await logEvent(session.tenantId, session.botId, session.callId, "ringing");
  return true;
}

export async function handleAdvisorWebrtcOutboundAnswered(
  payload: Record<string, unknown>
): Promise<boolean> {
  const { leg } = decodeTelnyxClientState(payload);
  if (leg !== "webrtc") return false;
  const session = await resolveContactCenterSession(payload);
  if (!session || session.direction !== "outbound" || session.mode !== "agent") return false;

  await updateTelephonySessionStatus(session.sessionId, "active");
  await updateCallRecord(session.tenantId, session.callId, {
    status: "accepted",
    startedAt: new Date().toISOString(),
  });
  if (session.advisorId) {
    await markAgentOnCall({ tenantId: session.tenantId, advisorId: session.advisorId });
  }
  await logEvent(session.tenantId, session.botId, session.callId, "answered");
  return true;
}

export async function handleOutboundCustomerAnswered(
  payload: Record<string, unknown>
): Promise<boolean> {
  const callControlId = String(payload.call_control_id ?? "");
  const session = await getTelephonySessionByCallControlId(callControlId);
  if (!session || session.direction !== "outbound" || session.mode !== "agent") return false;
  if (!session.advisorId) return false;
  const presence = await getAgentPresence(session.tenantId, session.advisorId);
  if (!presence?.telnyxSipUsername) return false;
  const { conferenceId } = await createConference({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    callControlId,
    name: `cc-${session.callId}`,
  });
  const secrets = await getTelnyxSecrets(ENVIRONMENT, session.tenantId);
  const agentDial = await dialCall({
    environment: ENVIRONMENT,
    tenantId: session.tenantId,
    to: `sip:${presence.telnyxSipUsername}@sip.telnyx.com`,
    from: session.fromNumber,
    connectionId: secrets.connectionId,
    clientState: encodeClientState({
      sessionId: session.sessionId,
      callId: session.callId,
      leg: "agent",
    }),
    timeoutSecs: 25,
  });
  await patchTelephonySession(session.sessionId, {
    conferenceId,
    agentCallControlId: agentDial.callControlId,
  });
  await indexTelephonyCallControlId(session.sessionId, agentDial.callControlId).catch(
    () => undefined
  );
  await updateCallRecord(session.tenantId, session.callId, { conferenceId, status: "accepted" });
  await markAgentOffered({ tenantId: session.tenantId, advisorId: session.advisorId });
  return true;
}

export async function tryDialNextCampaignRecipient(tenantId: string): Promise<void> {
  const campaigns = await listRunningVoiceCampaigns(tenantId);
  const agents = await listAgentPresence(tenantId);
  for (const campaign of campaigns) {
    if (campaign.mode !== "progressive") continue;
    const queue = await getContactCenterQueue(tenantId, campaign.queueId);
    if (!queue) continue;
    const agent = pickAgentForQueue(agents, queue);
    if (!agent) continue;
    const to = nextCampaignRecipient(campaign);
    if (!to) {
      await putVoiceCampaign({
        ...campaign,
        status: "completed",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      continue;
    }
    const result = await startPreviewOutbound({
      tenantId,
      botId: campaign.botId,
      advisorId: agent.advisorId,
      to,
      campaignId: campaign.campaignId,
    });
    const attempt: VoiceCampaignAttempt = {
      attemptId: randomUUID(),
      tenantId,
      campaignId: campaign.campaignId,
      to,
      callId: result.callId,
      status: "dialing",
      createdAt: new Date().toISOString(),
    };
    await putVoiceCampaignAttempt(attempt);
    const nextIndex = campaign.nextIndex + 1;
    await putVoiceCampaign({
      ...campaign,
      nextIndex,
      updatedAt: new Date().toISOString(),
      ...(nextIndex >= campaign.recipients.length
        ? { status: "completed", completedAt: new Date().toISOString() }
        : {}),
    });
    return;
  }
}

export async function refreshStaleAgentsAndDispatch(tenantId: string): Promise<void> {
  const agents = await listAgentPresence(tenantId);
  const now = Date.now();
  for (const agent of agents) {
    if (agent.state === "wrap_up" && agent.wrapUpUntil && Date.parse(agent.wrapUpUntil) <= now) {
      const { wrapUpUntil: _expired, ...rest } = agent;
      void _expired;
      await putAgentPresence({
        ...rest,
        state: "available",
        updatedAt: new Date(now).toISOString(),
      });
    }
  }
  const queues = await listContactCenterQueues(tenantId);
  for (const queue of queues) {
    await dispatchQueue(tenantId, queue.queueId);
  }
}