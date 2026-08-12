import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import {
  assertApiKeyScope,
  API_KEY_SCOPES,
} from "../../lib/api-keys/scopes.js";
import { getCallRecord, listCallsByBotPaginated } from "../../lib/dynamodb/call.repository.js";
import { listCallEvents } from "../../lib/dynamodb/call-event.repository.js";
import { getConversationMessages } from "../../lib/dynamodb/conversation.repository.js";
import {
  isTelnyxVoiceCall,
  toPublicVoiceCall,
  toPublicVoiceCallEvent,
  toPublicVoiceTranscriptMessage,
} from "../../lib/public-api/voice-calls.js";
import {
  startOutboundTelephonyCall,
  terminateTelephonyCall,
} from "../../lib/telephony/service.js";
import { getPresignedReadUrl } from "../../lib/s3/client.js";
import { badRequest, notFound, parseJsonBody } from "../../lib/http.js";
import type { Message } from "../../types/index.js";
import type { PublicApiAuth } from "./shared.js";

const VOICE_RECORDING_URL_TTL_SECONDS = 900;

const StartVoiceCallSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/, "Phone number must contain only digits"),
  contactName: z.string().min(1).max(128).optional(),
});

const LimitQuerySchema = z.coerce.number().int().min(1).max(100).optional();

const TranscriptCursorSchema = z.object({
  timestamp: z.string(),
  messageId: z.string(),
});

type TranscriptCursor = z.infer<typeof TranscriptCursorSchema>;

function parseLimitParam(value: string | undefined, fallback = 50): number {
  const parsed = LimitQuerySchema.safeParse(value);
  if (!parsed.success || parsed.data === undefined) return fallback;
  return parsed.data;
}

function decodeTranscriptCursor(cursor: string | undefined): TranscriptCursor | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const parsed = TranscriptCursorSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function encodeTranscriptCursor(message: Message): string {
  return Buffer.from(
    JSON.stringify({ timestamp: message.timestamp, messageId: message.messageId })
  ).toString("base64url");
}

function paginateTranscriptMessages(
  messages: Message[],
  limit: number,
  cursor: string | undefined
): { items: Message[]; nextCursor?: string } {
  const decoded = decodeTranscriptCursor(cursor);
  let filtered = messages;
  if (decoded) {
    filtered = messages.filter(
      (message) =>
        message.timestamp > decoded.timestamp ||
        (message.timestamp === decoded.timestamp && message.messageId > decoded.messageId)
    );
  }

  const items = filtered.slice(0, limit);
  const nextCursor =
    items.length === limit && filtered.length > limit
      ? encodeTranscriptCursor(items[items.length - 1]!)
      : undefined;

  return {
    items,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

async function getTelnyxCallForApiKey(
  tenantId: string,
  botId: string,
  callId: string
) {
  const call = await getCallRecord(tenantId, callId);
  if (!call || !isTelnyxVoiceCall(call, botId)) {
    throw Object.assign(new Error("Call not found"), { statusCode: 404 });
  }
  return call;
}

export async function handleStartVoiceCall(
  event: APIGatewayProxyEventV2,
  auth: PublicApiAuth
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsInitiate);

  const parsed = StartVoiceCallSchema.safeParse(parseJsonBody(event));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
  }

  const result = await startOutboundTelephonyCall({
    tenantId: apiKey.tenantId,
    botId: apiKey.botId,
    to: parsed.data.to,
    ...(parsed.data.contactName ? { contactName: parsed.data.contactName } : {}),
  });

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "POST /v1/voice/calls",
    method: "POST",
    statusCode: 201,
    durationMs: Date.now() - startMs,
    callId: result.callId,
    maskedPhone: auth.maskPhone(parsed.data.to),
  });

  return {
    statusCode: 201,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify({
      callId: result.callId,
      sessionId: result.sessionId,
      status: result.status,
      timestamp: new Date().toISOString(),
    }),
  };
}

export async function handleListVoiceCalls(
  event: APIGatewayProxyEventV2,
  auth: PublicApiAuth
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsRead);

  const limit = parseLimitParam(event.queryStringParameters?.limit);
  const cursor = event.queryStringParameters?.cursor;

  const { items, nextCursor } = await listCallsByBotPaginated(apiKey.botId, {
    limit,
    ...(cursor ? { cursor } : {}),
    provider: "telnyx",
  });

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "GET /v1/voice/calls",
    method: "GET",
    statusCode: 200,
    durationMs: Date.now() - startMs,
  });

  return {
    statusCode: 200,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify({
      items: items.map(toPublicVoiceCall),
      ...(nextCursor ? { nextCursor } : {}),
    }),
  };
}

export async function handleGetVoiceCall(
  _event: APIGatewayProxyEventV2,
  auth: PublicApiAuth,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsRead);

  const call = await getTelnyxCallForApiKey(apiKey.tenantId, apiKey.botId, callId);

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "GET /v1/voice/calls/{callId}",
    method: "GET",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    callId,
  });

  return {
    statusCode: 200,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify(toPublicVoiceCall(call)),
  };
}

export async function handleEndVoiceCall(
  _event: APIGatewayProxyEventV2,
  auth: PublicApiAuth,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsManage);

  await getTelnyxCallForApiKey(apiKey.tenantId, apiKey.botId, callId);
  await terminateTelephonyCall(apiKey.tenantId, callId);

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "POST /v1/voice/calls/{callId}/end",
    method: "POST",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    callId,
  });

  return {
    statusCode: 200,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify({ callId, status: "ending" }),
  };
}

export async function handleGetVoiceCallEvents(
  _event: APIGatewayProxyEventV2,
  auth: PublicApiAuth,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsRead);

  await getTelnyxCallForApiKey(apiKey.tenantId, apiKey.botId, callId);
  const events = await listCallEvents(apiKey.tenantId, callId);

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "GET /v1/voice/calls/{callId}/events",
    method: "GET",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    callId,
  });

  return {
    statusCode: 200,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify({ items: events.map(toPublicVoiceCallEvent) }),
  };
}

export async function handleGetVoiceCallTranscript(
  event: APIGatewayProxyEventV2,
  auth: PublicApiAuth,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsRead);

  const call = await getTelnyxCallForApiKey(apiKey.tenantId, apiKey.botId, callId);
  if (!call.conversationId) {
    return notFound("Transcript not available");
  }

  const limit = parseLimitParam(event.queryStringParameters?.limit, 50);
  const cursor = event.queryStringParameters?.cursor;
  const messages = await getConversationMessages(
    apiKey.tenantId,
    call.conversationId,
    200
  );
  const { items, nextCursor } = paginateTranscriptMessages(messages, limit, cursor);

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "GET /v1/voice/calls/{callId}/transcript",
    method: "GET",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    callId,
  });

  return {
    statusCode: 200,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify({
      items: items.map(toPublicVoiceTranscriptMessage),
      ...(nextCursor ? { nextCursor } : {}),
    }),
  };
}

export async function handleGetVoiceCallRecording(
  _event: APIGatewayProxyEventV2,
  auth: PublicApiAuth,
  callId: string
): Promise<APIGatewayProxyResultV2> {
  const startMs = Date.now();
  const { apiKey, hashedKey, rateResult } = auth;
  assertApiKeyScope(apiKey, API_KEY_SCOPES.voiceCallsRead);

  const call = await getTelnyxCallForApiKey(apiKey.tenantId, apiKey.botId, callId);
  if (!call.recordingS3Key || call.recordingStatus !== "ready") {
    return notFound("Recording not available");
  }

  const url = await getPresignedReadUrl(call.recordingS3Key, VOICE_RECORDING_URL_TTL_SECONDS);

  await auth.logUsage({
    apiKey,
    hashedKey,
    endpoint: "GET /v1/voice/calls/{callId}/recording",
    method: "GET",
    statusCode: 200,
    durationMs: Date.now() - startMs,
    callId,
  });

  return {
    statusCode: 200,
    headers: auth.successHeaders(apiKey, rateResult),
    body: JSON.stringify({
      url,
      expiresInSeconds: VOICE_RECORDING_URL_TTL_SECONDS,
    }),
  };
}

export function extractVoiceCallIdFromPath(path: string): string | null {
  const match = path.match(/\/v1\/voice\/calls\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function isVoiceCallSubPath(path: string, callId: string, suffix: string): boolean {
  return path.endsWith(`/v1/voice/calls/${callId}/${suffix}`);
}
