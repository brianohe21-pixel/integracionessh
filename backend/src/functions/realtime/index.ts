import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import {
  extractAuthContext,
  assertAdvisorOrMember,
} from "../../lib/auth/cognito.js";
import { getAdvisorByCognitoUserId } from "../../lib/dynamodb/advisor.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  findConversationById,
  addMessage,
} from "../../lib/dynamodb/conversation.repository.js";
import {
  createLiveKitCall,
  getLiveKitCall,
  getActiveLiveKitCallForConversation,
  updateLiveKitCallStatus,
} from "../../lib/dynamodb/livekit-call.repository.js";
import { assertCanStartLiveKitCall } from "../../lib/billing/assert-plan.js";
import { buildRoomName, getLiveKitConfig } from "../../lib/livekit/config.js";
import { createParticipantToken } from "../../lib/livekit/tokens.js";
import { deleteLiveKitRoom } from "../../lib/livekit/rooms.js";
import {
  ok,
  created,
  badRequest,
  notFound,
  handleError,
} from "../../lib/http.js";
import type { AuthContext, Conversation, LiveKitCall } from "../../types/index.js";

async function resolveAdvisorRecord(auth: AuthContext) {
  if (auth.role !== "advisor") return null;
  return getAdvisorByCognitoUserId(auth.tenantId, auth.userId);
}

async function assertCanAccessConversation(
  auth: AuthContext,
  conversation: Conversation
): Promise<void> {
  if (auth.role === "member") return;

  const advisor = await resolveAdvisorRecord(auth);
  if (!advisor || conversation.assignedAdvisorId !== advisor.advisorId) {
    const error = new Error("Access denied to this conversation");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

function parseConversationSubPath(rawPath: string, conversationId: string): string[] {
  const suffix = rawPath.split(`/conversations/${conversationId}`)[1] ?? "";
  return suffix.replace(/^\//, "").split("/").filter(Boolean);
}

function liveKitUnavailable(): APIGatewayProxyResultV2 {
  return {
    statusCode: 503,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "LiveKit is not configured" }),
  };
}

async function resolveParticipantIdentity(
  auth: AuthContext
): Promise<{ identity: string; initiatedBy: LiveKitCall["initiatedBy"]; initiatedById: string }> {
  if (auth.role === "advisor") {
    const advisor = await resolveAdvisorRecord(auth);
    if (!advisor) {
      const error = new Error("Advisor profile not found");
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }
    return {
      identity: `advisor:${advisor.advisorId}`,
      initiatedBy: "advisor",
      initiatedById: advisor.advisorId,
    };
  }

  return {
    identity: `member:${auth.userId}`,
    initiatedBy: "member",
    initiatedById: auth.userId,
  };
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertAdvisorOrMember(auth);

    const method = event.requestContext.http.method;
    const conversationId = event.pathParameters?.conversationId;
    const callId = event.pathParameters?.callId;
    const rawPath = event.rawPath ?? event.requestContext.http.path;

    if (!conversationId) return badRequest("conversationId is required");

    const conversation = await findConversationById(auth.tenantId, conversationId);
    if (!conversation) return notFound("Conversation not found");

    await assertCanAccessConversation(auth, conversation);

    const parts = parseConversationSubPath(rawPath, conversationId);

    if (method === "GET" && parts[0] === "calls" && parts[1] === "active") {
      const active = await getActiveLiveKitCallForConversation(conversationId);
      return ok(active);
    }

    if (method === "POST" && parts[0] === "calls" && parts.length === 1) {
      return handleCreateCall(auth, conversation);
    }

    if (method === "POST" && parts[0] === "calls" && parts[2] === "token" && callId) {
      return handleAdvisorToken(auth, conversation, callId);
    }

    if (method === "POST" && parts[0] === "calls" && parts[2] === "end" && callId) {
      return handleEndCall(conversation, callId);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateCall(
  auth: AuthContext,
  conversation: Conversation
): Promise<APIGatewayProxyResultV2> {
  const config = getLiveKitConfig();
  if (!config) return liveKitUnavailable();

  if (conversation.channel !== "webchat") {
    return badRequest("LiveKit calls are only supported for webchat conversations");
  }

  if (conversation.handoffMode !== "human") {
    return badRequest("Conversation must be in human handoff mode");
  }

  const bot = await getBot(conversation.tenantId, conversation.botId);
  if (!bot?.webchatEnabled || !bot.webchatVoiceEnabled) {
    return badRequest("Voice calls are not enabled for this bot");
  }

  const tenant = await getTenant(conversation.tenantId);
  if (tenant) await assertCanStartLiveKitCall(tenant);

  const existing = await getActiveLiveKitCallForConversation(conversation.conversationId);
  if (existing) {
    return badRequest("A call is already active for this conversation");
  }

  const participant = await resolveParticipantIdentity(auth);
  const now = new Date().toISOString();
  const callId = randomUUID();
  const roomName = buildRoomName(conversation.tenantId, conversation.conversationId);
  const videoEnabled = Boolean(bot.webchatVideoEnabled);

  const call: LiveKitCall = {
    callId,
    tenantId: conversation.tenantId,
    botId: conversation.botId,
    conversationId: conversation.conversationId,
    channel: "webchat",
    roomName,
    status: "ringing",
    initiatedBy: participant.initiatedBy,
    initiatedById: participant.initiatedById,
    videoEnabled,
    createdAt: now,
    updatedAt: now,
  };

  await createLiveKitCall(call);

  await addMessage(
    {
      messageId: `call-invite-${callId}`,
      conversationId: conversation.conversationId,
      tenantId: conversation.tenantId,
      role: "system",
      content: "Incoming voice call",
      channel: "webchat",
      messageType: "call_invite",
      metadata: {
        callId,
        roomName,
        status: "ringing",
        videoEnabled,
      },
      timestamp: now,
    },
    conversation.botId
  );

  return created({
    callId,
    roomName,
    status: "ringing",
    videoEnabled,
  });
}

async function handleAdvisorToken(
  auth: AuthContext,
  conversation: Conversation,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const config = getLiveKitConfig();
  if (!config) return liveKitUnavailable();

  const call = await getLiveKitCall(conversation.tenantId, callId);
  if (!call || call.conversationId !== conversation.conversationId) {
    return notFound("Call not found");
  }

  if (call.status !== "ringing" && call.status !== "active") {
    return badRequest("Call is not joinable");
  }

  const participant = await resolveParticipantIdentity(auth);
  const token = await createParticipantToken(config, {
    identity: participant.identity,
    roomName: call.roomName,
    canPublishVideo: call.videoEnabled,
  });

  if (call.status === "ringing") {
    await updateLiveKitCallStatus(conversation.tenantId, callId, "active", {
      startedAt: new Date().toISOString(),
    });
  }

  return ok({
    token,
    url: config.url,
    roomName: call.roomName,
    videoEnabled: call.videoEnabled,
  });
}

async function handleEndCall(
  conversation: Conversation,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const config = getLiveKitConfig();
  if (!config) return liveKitUnavailable();

  const call = await getLiveKitCall(conversation.tenantId, callId);
  if (!call || call.conversationId !== conversation.conversationId) {
    return notFound("Call not found");
  }

  if (call.status === "ended" || call.status === "declined" || call.status === "missed") {
    return ok({ callId, status: call.status });
  }

  const now = new Date().toISOString();
  await updateLiveKitCallStatus(conversation.tenantId, callId, "ended", { endedAt: now });
  await deleteLiveKitRoom(config, call.roomName);

  await addMessage(
    {
      messageId: `call-ended-${callId}`,
      conversationId: conversation.conversationId,
      tenantId: conversation.tenantId,
      role: "system",
      content: "Call ended",
      channel: "webchat",
      messageType: "call_ended",
      metadata: { callId, status: "ended" },
      timestamp: now,
    },
    conversation.botId
  );

  return ok({ callId, status: "ended" });
}
