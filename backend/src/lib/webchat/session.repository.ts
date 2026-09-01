import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { WebChatSession, WebChatSessionStatus } from "../../types/index.js";

const SESSION_TTL_SECONDS = 24 * 60 * 60;

function sessionKey(sessionId: string) {
  return {
    PK: `WEBCHAT_SESSION#${sessionId}`,
    SK: "META",
  };
}

export function generateWidgetKey(): string {
  return `wck_${randomBytes(24).toString("base64url")}`;
}

export function createSessionToken(sessionId: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): string | null {
  const [sessionId, sig] = token.split(".");
  if (!sessionId || !sig) return null;
  const expected = createHmac("sha256", secret).update(sessionId).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return sessionId;
  } catch {
    return null;
  }
}

export async function createWebChatSession(params: {
  sessionId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  visitorName?: string;
}): Promise<WebChatSession> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const session: WebChatSession = {
    sessionId: params.sessionId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversationId,
    ...(params.visitorName ? { visitorName: params.visitorName } : {}),
    status: "active",
    createdAt: now,
    lastActivityAt: now,
    ttl,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...sessionKey(params.sessionId), ...session },
    })
  );

  return session;
}

export async function getWebChatSession(sessionId: string): Promise<WebChatSession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
    })
  );
  if (!result.Item) return null;
  const { PK, SK, ...rest } = result.Item;
  return rest as WebChatSession;
}

export async function touchWebChatSession(sessionId: string): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: "SET lastActivityAt = :now, #ttl = :ttl",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":now": new Date().toISOString(),
        ":ttl": ttl,
      },
    })
  );
}

export async function updateWebChatSessionIdentity(
  sessionId: string,
  updates: {
    visitorName?: string;
    visitorPhone?: string;
    visitorEmail?: string;
  }
): Promise<WebChatSession | null> {
  const parts: string[] = ["lastActivityAt = :now"];
  const values: Record<string, unknown> = {
    ":now": new Date().toISOString(),
  };
  const names: Record<string, string> = {};

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

  if (parts.length === 1) {
    return getWebChatSession(sessionId);
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: `SET ${parts.join(", ")}`,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) return null;
  const { PK, SK, ...rest } = result.Attributes;
  return rest as WebChatSession;
}

export function isWebChatSessionEnded(session: WebChatSession): boolean {
  return session.status === "ended";
}

export async function endWebChatSession(sessionId: string): Promise<WebChatSessionStatus> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: sessionKey(sessionId),
      UpdateExpression: "SET #status = :ended, endedAt = :now, lastActivityAt = :now, #ttl = :ttl",
      ExpressionAttributeNames: { "#status": "status", "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":ended": "ended",
        ":now": now,
        ":ttl": ttl,
      },
    })
  );
  return "ended";
}
