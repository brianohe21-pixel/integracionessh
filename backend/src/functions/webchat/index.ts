import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getBotByWidgetKey } from "../../lib/dynamodb/bot-lookup.repository.js";
import { getOrCreateConversation } from "../../lib/dynamodb/conversation.repository.js";
import { getConversationMessages } from "../../lib/dynamodb/conversation.repository.js";
import {
  createSessionToken,
  createWebChatSession,
  getWebChatSession,
  touchWebChatSession,
  verifySessionToken,
} from "../../lib/webchat/session.repository.js";
import { assertCanUseWebChat } from "../../lib/billing/assert-plan.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { ok, created, badRequest, unauthorized, notFound, handleError } from "../../lib/http.js";
import type { InboundQueueMessage } from "../../types/index.js";
import { getLiveKitCall, updateLiveKitCallStatus } from "../../lib/dynamodb/livekit-call.repository.js";
import { getLiveKitConfig } from "../../lib/livekit/config.js";
import { createParticipantToken } from "../../lib/livekit/tokens.js";
import { deleteLiveKitRoom } from "../../lib/livekit/rooms.js";
import { addMessage } from "../../lib/dynamodb/conversation.repository.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";
const SESSION_SECRET = process.env.WEBCHAT_SESSION_SECRET ?? "dev-webchat-secret";

const CreateSessionSchema = z.object({
  botId: z.string().uuid(),
  visitorName: z.string().max(120).optional(),
});

const SendMessageSchema = z.object({
  content: z.string().min(1).max(2048),
});

function getWidgetKey(event: APIGatewayProxyEventV2): string | undefined {
  return event.headers["x-widget-key"] ?? event.headers["X-Widget-Key"];
}

function getSessionAuth(event: APIGatewayProxyEventV2): string | undefined {
  const auth = event.headers.authorization ?? event.headers.Authorization;
  if (!auth?.startsWith("Bearer ")) return undefined;
  return auth.slice(7);
}

function parseSubPath(rawPath: string, sessionId: string): string[] {
  const suffix = rawPath.split(`/webchat/sessions/${sessionId}`)[1] ?? "";
  return suffix.replace(/^\//, "").split("/").filter(Boolean);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const sessionId = event.pathParameters?.sessionId;

    if (method === "POST" && rawPath.endsWith("/webchat/sessions") && !sessionId) {
      return handleCreateSession(event);
    }

    if (!sessionId) return badRequest("Route not found");

    const sub = parseSubPath(rawPath, sessionId);

    if (method === "POST" && sub[0] === "messages") {
      return handleSendMessage(event, sessionId);
    }

    if (method === "GET" && (sub[0] === "messages" || sub.length === 0)) {
      return handlePollMessages(event, sessionId);
    }

    if (method === "POST" && sub[0] === "calls" && sub[2] === "token" && sub[1]) {
      return handleVisitorCallToken(event, sessionId, sub[1]);
    }

    if (method === "POST" && sub[0] === "calls" && sub[2] === "decline" && sub[1]) {
      return handleVisitorCallDecline(event, sessionId, sub[1]);
    }

    if (method === "POST" && sub[0] === "calls" && sub[2] === "accept" && sub[1]) {
      return handleVisitorCallToken(event, sessionId, sub[1]);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateSession(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const widgetKey = getWidgetKey(event);
  if (!widgetKey) return unauthorized("Missing X-Widget-Key");

  const lookup = await getBotByWidgetKey(widgetKey);
  if (!lookup) return unauthorized("Invalid widget key");

  const body = JSON.parse(event.body ?? "{}");
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  if (parsed.data.botId !== lookup.botId) {
    return unauthorized("Widget key does not match bot");
  }

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot || !bot.webchatEnabled) return badRequest("Web chat not enabled for this bot");

  const tenant = await getTenant(lookup.tenantId);
  if (tenant) await assertCanUseWebChat(tenant);

  const sessionId = randomUUID();
  const conversation = await getOrCreateConversation(
    lookup.tenantId,
    lookup.botId,
    "webchat",
    sessionId,
    parsed.data.visitorName
  );

  await createWebChatSession({
    sessionId,
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    conversationId: conversation.conversationId,
    ...(parsed.data.visitorName ? { visitorName: parsed.data.visitorName } : {}),
  });

  const sessionToken = createSessionToken(sessionId, SESSION_SECRET);

  return created({
    sessionId,
    sessionToken,
    conversationId: conversation.conversationId,
  });
}

async function handleSendMessage(
  event: APIGatewayProxyEventV2,
  sessionId: string
): Promise<APIGatewayProxyResultV2> {
  const token = getSessionAuth(event);
  if (!token) return unauthorized("Missing session token");

  const verifiedSessionId = verifySessionToken(token, SESSION_SECRET);
  if (!verifiedSessionId || verifiedSessionId !== sessionId) {
    return unauthorized("Invalid session token");
  }

  const session = await getWebChatSession(sessionId);
  if (!session) return notFound("Session not found");

  const body = JSON.parse(event.body ?? "{}");
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const messageId = `wc-${randomUUID()}`;
  const sqsBody: InboundQueueMessage = {
    channel: "webchat",
    tenantId: session.tenantId,
    botId: session.botId,
    participantId: sessionId,
    conversationKey: `${session.tenantId}-${session.botId}-webchat-${sessionId}`,
    ...(session.visitorName ? { displayName: session.visitorName } : {}),
    replyToExternalId: messageId,
    payload: {
      messageId,
      text: parsed.data.content,
      sessionId,
    },
  };

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(sqsBody),
      MessageGroupId: sqsBody.conversationKey,
      MessageDeduplicationId: messageId,
    })
  );

  await touchWebChatSession(sessionId);

  return created({ messageId, queued: true });
}

async function handlePollMessages(
  event: APIGatewayProxyEventV2,
  sessionId: string
): Promise<APIGatewayProxyResultV2> {
  const token = getSessionAuth(event);
  if (!token) return unauthorized("Missing session token");

  const verifiedSessionId = verifySessionToken(token, SESSION_SECRET);
  if (!verifiedSessionId || verifiedSessionId !== sessionId) {
    return unauthorized("Invalid session token");
  }

  const session = await getWebChatSession(sessionId);
  if (!session) return notFound("Session not found");

  const params = event.queryStringParameters ?? {};
  const limit = params.limit ? Math.min(parseInt(params.limit, 10) || 50, 100) : 50;

  const messages = await getConversationMessages(session.tenantId, session.conversationId, limit);
  await touchWebChatSession(sessionId);

  return ok({
    items: messages.map((m) => ({
      messageId: m.messageId,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      messageType: m.messageType,
      metadata: m.metadata,
    })),
  });
}

async function handleVisitorCallToken(
  event: APIGatewayProxyEventV2,
  sessionId: string,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const token = getSessionAuth(event);
  if (!token) return unauthorized("Missing session token");

  const verifiedSessionId = verifySessionToken(token, SESSION_SECRET);
  if (!verifiedSessionId || verifiedSessionId !== sessionId) {
    return unauthorized("Invalid session token");
  }

  const session = await getWebChatSession(sessionId);
  if (!session) return notFound("Session not found");

  const config = getLiveKitConfig();
  if (!config) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "LiveKit is not configured" }),
    };
  }

  const call = await getLiveKitCall(session.tenantId, callId);
  if (!call || call.conversationId !== session.conversationId) {
    return notFound("Call not found");
  }

  if (call.status !== "ringing" && call.status !== "active") {
    return badRequest("Call is not joinable");
  }

  const livekitToken = await createParticipantToken(config, {
    identity: `visitor:${sessionId}`,
    roomName: call.roomName,
    canPublishVideo: call.videoEnabled,
  });

  if (call.status === "ringing") {
    await updateLiveKitCallStatus(session.tenantId, callId, "active", {
      startedAt: new Date().toISOString(),
    });
  }

  await touchWebChatSession(sessionId);

  return ok({
    token: livekitToken,
    url: config.url,
    roomName: call.roomName,
    videoEnabled: call.videoEnabled,
  });
}

async function handleVisitorCallDecline(
  event: APIGatewayProxyEventV2,
  sessionId: string,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const token = getSessionAuth(event);
  if (!token) return unauthorized("Missing session token");

  const verifiedSessionId = verifySessionToken(token, SESSION_SECRET);
  if (!verifiedSessionId || verifiedSessionId !== sessionId) {
    return unauthorized("Invalid session token");
  }

  const session = await getWebChatSession(sessionId);
  if (!session) return notFound("Session not found");

  const config = getLiveKitConfig();
  const call = await getLiveKitCall(session.tenantId, callId);
  if (!call || call.conversationId !== session.conversationId) {
    return notFound("Call not found");
  }

  if (call.status === "ended" || call.status === "declined") {
    return ok({ callId, status: call.status });
  }

  const now = new Date().toISOString();
  await updateLiveKitCallStatus(session.tenantId, callId, "declined", { endedAt: now });
  if (config) await deleteLiveKitRoom(config, call.roomName);

  await addMessage(
    {
      messageId: `call-declined-${callId}`,
      conversationId: session.conversationId,
      tenantId: session.tenantId,
      role: "system",
      content: "Call declined",
      channel: "webchat",
      messageType: "call_ended",
      metadata: { callId, status: "declined" },
      timestamp: now,
    },
    session.botId
  );

  await touchWebChatSession(sessionId);

  return ok({ callId, status: "declined" });
}
