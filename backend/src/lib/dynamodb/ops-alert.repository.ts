import { randomUUID } from "crypto";
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import type { OpsAlert, OpsAlertRuleId, OpsAlertSeverity } from "../../types/index.js";

const ALERT_TTL_SECONDS = 90 * 24 * 60 * 60;
const DEDUPE_TTL_SECONDS = 30 * 24 * 60 * 60;

function alertKeys(tenantId: string, createdAt: string, alertId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `OPSALERT#${createdAt}#${alertId}`,
  };
}

function dedupeKeys(tenantId: string, dedupeKey: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `OPSALERTDEDUP#${dedupeKey}`,
  };
}

function stripAlert(item: Record<string, unknown>): OpsAlert {
  const { PK, SK, ttl, ...rest } = item;
  void PK;
  void SK;
  void ttl;
  return rest as unknown as OpsAlert;
}

export async function tryClaimOpsAlertDedupe(
  tenantId: string,
  dedupeKey: string,
  ttlSeconds = DEDUPE_TTL_SECONDS
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...dedupeKeys(tenantId, dedupeKey),
          tenantId,
          dedupeKey,
          claimedAt: new Date().toISOString(),
          ttl: now + ttlSeconds,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return false;
    }
    throw error;
  }
}

export async function releaseOpsAlertDedupe(
  tenantId: string,
  dedupeKey: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: dedupeKeys(tenantId, dedupeKey),
    })
  );
}

export async function createOpsAlert(params: {
  tenantId: string;
  ruleId: OpsAlertRuleId;
  title: string;
  body: string;
  href: string;
  severity: OpsAlertSeverity;
  dedupeKey: string;
}): Promise<OpsAlert> {
  const alertId = randomUUID();
  const createdAt = new Date().toISOString();
  const alert: OpsAlert = {
    alertId,
    tenantId: params.tenantId,
    ruleId: params.ruleId,
    title: params.title,
    body: params.body,
    href: params.href,
    severity: params.severity,
    dedupeKey: params.dedupeKey,
    createdAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...alertKeys(params.tenantId, createdAt, alertId),
        ...alert,
        ttl: Math.floor(Date.now() / 1000) + ALERT_TTL_SECONDS,
      },
    })
  );

  return alert;
}

export async function listOpsAlerts(
  tenantId: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<OpsAlert[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const items: OpsAlert[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": "OPSALERT#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
        Limit: limit,
      })
    );

    for (const item of result.Items ?? []) {
      const alert = stripAlert(item);
      if (options?.unreadOnly && alert.readAt) continue;
      items.push(alert);
      if (items.length >= limit) return items;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey && items.length < limit);

  return items;
}

export async function markOpsAlertRead(
  tenantId: string,
  alertId: string
): Promise<OpsAlert | null> {
  const alerts = await listOpsAlerts(tenantId, { limit: 100 });
  const match = alerts.find((alert) => alert.alertId === alertId);
  if (!match) return null;
  if (match.readAt) return match;

  const readAt = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: alertKeys(tenantId, match.createdAt, match.alertId),
      UpdateExpression: "SET readAt = :readAt",
      ExpressionAttributeValues: { ":readAt": readAt },
    })
  );

  return { ...match, readAt };
}

export async function markAllOpsAlertsRead(tenantId: string): Promise<number> {
  const alerts = await listOpsAlerts(tenantId, { limit: 100, unreadOnly: true });
  const readAt = new Date().toISOString();
  await Promise.all(
    alerts.map((alert) =>
      docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: alertKeys(tenantId, alert.createdAt, alert.alertId),
          UpdateExpression: "SET readAt = :readAt",
          ExpressionAttributeValues: { ":readAt": readAt },
        })
      )
    )
  );
  return alerts.length;
}
