import { randomBytes } from "crypto";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { BotLocale, TelephonySession, TelephonySessionStatus } from "../../types/index.js";

const SESSION_TTL_SECONDS = 24 * 60 * 60;

function sessionKey(sessionId: string) {
  return {
    PK: `TELEPHONY_SESSION#${sessionId}`,
    SK: "META",
  };
}

function callControlIndexKey(callControlId: string) {
  return {
    PK: `TELEPHONY_CALL#${callControlId}`,
    SK: "META",
  };
}

function streamTokenIndexKey(streamToken: string) {
  return {
    PK: `TELEPHONY_STREAM#${streamToken}`,
    SK: "META",
  };
}

export function generateStreamToken(): string {
  return `st_${randomBytes(24).toString("base64url")}`;
}

export async function createTelephonySession(params: {
  sessionId: string;
  callControlId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  direction: TelephonySession["direction"];
  fromNumber: string;
  toNumber: string;
  locale: BotLocale;
  contactName?: string;
  mode?: TelephonySession["mode"];
  queueId?: string;
  ivrFlowId?: string;
  campaignId?: string;
  advisorId?: string;
}): Promise<TelephonySession> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const streamToken = generateStreamToken();
  const session: TelephonySession = {
    sessionId: params.sessionId,
    callControlId: params.callControlId,
    callId: params.callId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    participantId: params.participantId,
    direction: params.direction,
    fromNumber: params.fromNumber,
    toNumber: params.toNumber,
    status: "pending",
    streamToken,
    locale: params.locale,
    startedAt: now,
    ttl,
    ...(params.contactName ? { contactName: params.contactName } : {}),
    ...(params.mode ? { mode: params.mode } : {}),
    ...(params.queueId ? { queueId: params.queueId } : {}),
    ...(params.ivrFlowId ? { ivrFlowId: params.ivrFlowId } : {}),
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    ...(params.advisorId ? { advisorId: params.advisorId } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...sessionKey(params.sessionId), ...session },
    })
  );

  if (params.callControlId !== "pending") {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...callControlIndexKey(params.callControlId),
          sessionId: params.sessionId,
          tenantId: params.tenantId,
          botId: params.botId,
          ttl,
        },
      })
    );
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...streamTokenIndexKey(streamToken),
        sessionId: params.sessionId,
        ttl,
      },
    })
  );

  return session;
}

export async function getTelephonySession(sessionId: string): Promise<TelephonySession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  void PK;
  void SK;
  return rest as TelephonySession;
}

export async function getTelephonySessionByCallControlId(
  callControlId: string
): Promise<TelephonySession | null> {
  const indexResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: callControlIndexKey(callControlId),
    })
  );
  const sessionId = indexResult.Item?.sessionId as string | undefined;
  if (!sessionId) return null;
  return getTelephonySession(sessionId);
}

export async function getTelephonySessionByStreamToken(
  streamToken: string
): Promise<TelephonySession | null> {
  const indexResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: streamTokenIndexKey(streamToken),
    })
  );
  const sessionId = indexResult.Item?.sessionId as string | undefined;
  if (!sessionId) return null;
  return getTelephonySession(sessionId);
}

export async function updateTelephonySessionStatus(
  sessionId: string,
  status: TelephonySessionStatus
): Promise<TelephonySession | null> {
  return patchTelephonySession(sessionId, { status });
}

export async function patchTelephonySession(
  sessionId: string,
  updates: Partial<
    Pick<
      TelephonySession,
      | "status"
      | "mode"
      | "queueId"
      | "conferenceId"
      | "advisorId"
      | "agentCallControlId"
      | "supervisorCallControlId"
      | "supervisorRole"
      | "ivrFlowId"
      | "ivrNodeId"
      | "campaignId"
      | "consultCallControlId"
      | "callControlId"
    >
  >
): Promise<TelephonySession | null> {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const expressions: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    expressions.push(`#${key} = :${key}`);
  }
  if (expressions.length === 0) return getTelephonySession(sessionId);

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  if (!result.Attributes) return null;
  const { PK, SK, ...rest } = result.Attributes;
  void PK;
  void SK;
  return rest as TelephonySession;
}

export async function clearTelephonySupervisor(sessionId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: "REMOVE supervisorCallControlId, supervisorRole",
    })
  );
}

export async function indexTelephonyCallControlId(
  sessionId: string,
  callControlId: string
): Promise<void> {
  const session = await getTelephonySession(sessionId);
  if (!session) return;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...callControlIndexKey(callControlId),
        sessionId,
        tenantId: session.tenantId,
        botId: session.botId,
        ttl: session.ttl,
      },
    })
  );
}

export async function attachTelephonyCallControlId(
  sessionId: string,
  callControlId: string
): Promise<void> {
  const session = await getTelephonySession(sessionId);
  if (!session) return;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: "SET callControlId = :callControlId, #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":callControlId": callControlId,
        ":status": "ringing",
      },
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...callControlIndexKey(callControlId),
        sessionId,
        tenantId: session.tenantId,
        botId: session.botId,
        ttl: session.ttl,
      },
    })
  );
}

export async function endTelephonySession(
  sessionId: string,
  durationSeconds: number
): Promise<TelephonySession | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression:
        "SET #status = :ended, endedAt = :now, durationSeconds = :duration",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":ended": "ended" satisfies TelephonySessionStatus,
        ":now": now,
        ":duration": durationSeconds,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  if (!result.Attributes) return null;
  const { PK, SK, ...rest } = result.Attributes;
  void PK;
  void SK;
  return rest as TelephonySession;
}
