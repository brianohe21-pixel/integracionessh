import { randomBytes } from "crypto";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { VoicebotSession, VoicebotSessionStatus } from "../../types/index.js";

const SESSION_TTL_SECONDS = 24 * 60 * 60;

function sessionKey(sessionId: string) {
  return {
    PK: `VOICEBOT_SESSION#${sessionId}`,
    SK: "META",
  };
}

function callIndexKey(callId: string) {
  return {
    PK: `VOICEBOT_CALL#${callId}`,
    SK: "META",
  };
}

export function generateVoicebotWidgetKey(): string {
  return `vbk_${randomBytes(24).toString("base64url")}`;
}

export async function createVoicebotSession(params: {
  sessionId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  ephemeralKey?: string;
  visitorName?: string;
}): Promise<VoicebotSession> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const session: VoicebotSession = {
    sessionId: params.sessionId,
    callId: params.callId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    participantId: params.participantId,
    status: "active",
    startedAt: now,
    ttl,
    ...(params.ephemeralKey ? { ephemeralKey: params.ephemeralKey } : {}),
    ...(params.visitorName ? { visitorName: params.visitorName } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...sessionKey(params.sessionId), ...session },
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...callIndexKey(params.callId),
        sessionId: params.sessionId,
        tenantId: params.tenantId,
        botId: params.botId,
        ttl,
      },
    })
  );

  return session;
}

export async function getVoicebotSession(sessionId: string): Promise<VoicebotSession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as VoicebotSession;
}

export async function getVoicebotSessionByCallId(callId: string): Promise<VoicebotSession | null> {
  const indexResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: callIndexKey(callId),
    })
  );
  const sessionId = indexResult.Item?.sessionId as string | undefined;
  if (!sessionId) return null;
  return getVoicebotSession(sessionId);
}

export async function updateVoicebotSessionIdentity(
  sessionId: string,
  updates: {
    visitorName?: string;
    visitorPhone?: string;
    visitorEmail?: string;
  }
): Promise<VoicebotSession | null> {
  const parts: string[] = [];
  const values: Record<string, unknown> = {};

  if (updates.visitorName) {
    parts.push("visitorName = :visitorName");
    values[":visitorName"] = updates.visitorName;
  }
  if (updates.visitorPhone) {
    parts.push("visitorPhone = :visitorPhone");
    values[":visitorPhone"] = updates.visitorPhone;
  }
  if (updates.visitorEmail) {
    parts.push("visitorEmail = :visitorEmail");
    values[":visitorEmail"] = updates.visitorEmail;
  }

  if (!parts.length) {
    return getVoicebotSession(sessionId);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;
  const { PK, SK, ...rest } = result.Attributes;
  return rest as VoicebotSession;
}

export async function endVoicebotSession(
  sessionId: string,
  durationSeconds: number
): Promise<VoicebotSession | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression:
        "SET #status = :ended, endedAt = :now, durationSeconds = :duration",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":ended": "ended" satisfies VoicebotSessionStatus,
        ":now": now,
        ":duration": durationSeconds,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  if (!result.Attributes) return null;
  const { PK, SK, ...rest } = result.Attributes;
  return rest as VoicebotSession;
}
