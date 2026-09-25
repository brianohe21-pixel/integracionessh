import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";
import type { Permission } from "../auth/permissions.js";

export type AuditModule = "bots" | "campaigns" | "contacts" | "payments" | "settings";

export interface AuditEvent {
  eventId: string;
  tenantId: string;
  actorUserId: string;
  actorEmail: string;
  module: AuditModule;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export async function writeAuditEvent(params: {
  tenantId: string;
  actorUserId: string;
  actorEmail: string;
  module: AuditModule;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const eventId = randomUUID();
  const event: AuditEvent = {
    eventId,
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    module: params.module,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    summary: params.summary.slice(0, 240),
    createdAt: now,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `TENANT#${params.tenantId}`,
          SK: `AUDIT#${now}#${eventId}`,
          ...event,
        },
      })
    );
  } catch (error) {
    console.error("Failed to write audit event", error);
  }
}

export async function listAuditEvents(params: {
  tenantId: string;
  module?: AuditModule;
  limit: number;
  cursor?: string;
}): Promise<{ items: AuditEvent[]; nextCursor?: string }> {
  const exclusiveStartKey = decodeCursor(params.cursor);
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `TENANT#${params.tenantId}`,
        ":sk": "AUDIT#",
        ...(params.module ? { ":module": params.module } : {}),
      },
      ...(params.module
        ? {
            FilterExpression: "#module = :module",
            ExpressionAttributeNames: { "#module": "module" },
          }
        : {}),
      ScanIndexForward: false,
      Limit: params.limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    })
  );

  const items = (result.Items ?? []).map(({ PK, SK, ...rest }) => rest as AuditEvent);
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64url")
    : undefined;

  return nextCursor ? { items, nextCursor } : { items };
}

function decodeCursor(cursor?: string): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof parsed.PK !== "string" || typeof parsed.SK !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function auditModuleFromPermission(permission: Permission): AuditModule | null {
  const module = permission.split(".")[0];
  if (
    module === "bots" ||
    module === "campaigns" ||
    module === "contacts" ||
    module === "payments" ||
    module === "settings"
  ) {
    return module;
  }
  return null;
}
