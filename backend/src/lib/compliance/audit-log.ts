import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, TABLE_NAME } from "../dynamodb/client.js";

export type ComplianceAction =
  | "marketing_blocked"
  | "consent_updated"
  | "suppressed"
  | "unsuppressed";

export async function writeComplianceLog(params: {
  tenantId: string;
  action: ComplianceAction;
  phone: string;
  reason: string;
  actorUserId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const id = randomUUID();

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${params.tenantId}`,
        SK: `COMPLIANCELOG#${now}#${id}`,
        tenantId: params.tenantId,
        logId: id,
        action: params.action,
        phone: params.phone,
        reason: params.reason,
        actorUserId: params.actorUserId,
        createdAt: now,
      },
    })
  );
}
