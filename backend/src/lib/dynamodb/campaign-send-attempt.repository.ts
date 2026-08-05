import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import { parseDeliveryFailureError } from "./bulk-job.repository.js";
import type {
  CampaignSendAttempt,
  CampaignSendAttemptStatus,
  CampaignSendFailureKind,
  OutreachChannel,
  WhatsAppStatus,
} from "../../types/index.js";
import type { TelcoredDlrCallback } from "../sms/dlr.js";
import type { SmsDlrReceipt } from "../../types/index.js";

const ATTEMPT_TTL_SECONDS = 90 * 24 * 60 * 60;

function attemptKeys(tenantId: string, campaignId: string, attemptId: string) {
  return {
    PK: `TENANT#${tenantId}`,
    SK: `CAMPATT#${campaignId}#${attemptId}`,
  };
}

function stripAttemptItem(item: Record<string, unknown>): CampaignSendAttempt {
  const { PK, SK, ttl: _ttl, ...rest } = item;
  return rest as unknown as CampaignSendAttempt;
}

export interface EnsureCampaignSendAttemptInput {
  attemptId: string;
  tenantId: string;
  campaignId: string;
  to: string;
  channel: OutreachChannel;
  templateName: string;
  language: string;
  recipientKey?: string;
  batchVersion?: number;
  batchIndex?: number;
}

export async function getCampaignSendAttempt(
  tenantId: string,
  campaignId: string,
  attemptId: string
): Promise<CampaignSendAttempt | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: attemptKeys(tenantId, campaignId, attemptId),
    })
  );
  if (!result.Item) return null;
  return stripAttemptItem(result.Item);
}

export async function ensureCampaignSendAttempt(
  input: EnsureCampaignSendAttemptInput
): Promise<{ attempt: CampaignSendAttempt; isNew: boolean }> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + ATTEMPT_TTL_SECONDS;
  const attempt: CampaignSendAttempt = {
    attemptId: input.attemptId,
    tenantId: input.tenantId,
    campaignId: input.campaignId,
    to: input.to.replace(/\D/g, ""),
    channel: input.channel,
    status: "queued",
    templateName: input.templateName,
    language: input.language,
    queuedAt: now,
    createdAt: now,
    updatedAt: now,
    ...(input.recipientKey ? { recipientKey: input.recipientKey } : {}),
    ...(input.batchVersion !== undefined ? { batchVersion: input.batchVersion } : {}),
    ...(input.batchIndex !== undefined ? { batchIndex: input.batchIndex } : {}),
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...attemptKeys(input.tenantId, input.campaignId, input.attemptId), ...attempt, ttl },
        ConditionExpression: "attribute_not_exists(SK)",
      })
    );
    return { attempt, isNew: true };
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      const existing = await getCampaignSendAttempt(
        input.tenantId,
        input.campaignId,
        input.attemptId
      );
      if (!existing) throw error;
      return { attempt: existing, isNew: false };
    }
    throw error;
  }
}

export function isCampaignSendAttemptTerminal(status: CampaignSendAttemptStatus): boolean {
  return status !== "queued";
}

export async function markCampaignSendAttemptFailed(
  tenantId: string,
  campaignId: string,
  attemptId: string,
  input: {
    status: "compliance_blocked" | "send_failed";
    failureKind: CampaignSendFailureKind;
    failedAt?: string;
    sendErrorCode?: number;
    sendErrorTitle?: string;
    sendErrorMessage: string;
  }
): Promise<void> {
  const failedAt = input.failedAt ?? new Date().toISOString();
  const sets = ["#status = :status", "failureKind = :failureKind", "failedAt = :failedAt", "sendErrorMessage = :msg"];
  const exprValues: Record<string, unknown> = {
    ":status": input.status,
    ":failureKind": input.failureKind,
    ":failedAt": failedAt,
    ":msg": input.sendErrorMessage,
    ":queued": "queued",
  };
  const exprNames = { "#status": "status" };

  if (input.sendErrorCode != null) {
    sets.push("sendErrorCode = :code");
    exprValues[":code"] = input.sendErrorCode;
  }
  if (input.sendErrorTitle) {
    sets.push("sendErrorTitle = :title");
    exprValues[":title"] = input.sendErrorTitle;
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: attemptKeys(tenantId, campaignId, attemptId),
        UpdateExpression: `SET ${sets.join(", ")}, updatedAt = :now`,
        ConditionExpression: "#status = :queued",
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: { ...exprValues, ":now": new Date().toISOString() },
      })
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return;
    throw error;
  }
}

export async function markCampaignSendAttemptSent(
  tenantId: string,
  campaignId: string,
  attemptId: string,
  input: {
    sentAt?: string;
    externalMessageId?: string;
    waMessageId?: string;
    smsReceiptId?: string;
    telcoredMessageId?: string;
  }
): Promise<void> {
  const sentAt = input.sentAt ?? new Date().toISOString();
  const sets = ["#status = :status", "sentAt = :sentAt"];
  const exprValues: Record<string, unknown> = {
    ":status": "sent",
    ":sentAt": sentAt,
    ":queued": "queued",
  };
  const exprNames = { "#status": "status" };

  if (input.externalMessageId) {
    sets.push("externalMessageId = :externalMessageId");
    exprValues[":externalMessageId"] = input.externalMessageId;
  }
  if (input.waMessageId) {
    sets.push("waMessageId = :waMessageId");
    exprValues[":waMessageId"] = input.waMessageId;
  }
  if (input.smsReceiptId) {
    sets.push("smsReceiptId = :smsReceiptId");
    exprValues[":smsReceiptId"] = input.smsReceiptId;
  }
  if (input.telcoredMessageId) {
    sets.push("telcoredMessageId = :telcoredMessageId");
    exprValues[":telcoredMessageId"] = input.telcoredMessageId;
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: attemptKeys(tenantId, campaignId, attemptId),
        UpdateExpression: `SET ${sets.join(", ")}, updatedAt = :now`,
        ConditionExpression: "#status = :queued",
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: { ...exprValues, ":now": new Date().toISOString() },
      })
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return;
    throw error;
  }
}

export async function applyWhatsAppStatusToAttempt(
  tenantId: string,
  campaignId: string,
  attemptId: string,
  status: WhatsAppStatus
): Promise<void> {
  const eventAt = new Date(Number.parseInt(status.timestamp, 10) * 1000).toISOString();

  if (status.status === "delivered") {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: attemptKeys(tenantId, campaignId, attemptId),
          UpdateExpression:
            "SET #status = :delivered, deliveredAt = :eventAt, waRecipientId = :recipientId, updatedAt = :now",
          ConditionExpression: "#status IN (:sent, :delivered)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":delivered": "delivered",
            ":sent": "sent",
            ":eventAt": eventAt,
            ":recipientId": status.recipient_id,
            ":now": new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return;
      throw error;
    }
    return;
  }

  if (status.status === "read") {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: attemptKeys(tenantId, campaignId, attemptId),
          UpdateExpression:
            "SET #status = :read, readAt = :eventAt, waRecipientId = :recipientId, updatedAt = :now",
          ConditionExpression: "#status IN (:sent, :delivered, :read)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":read": "read",
            ":sent": "sent",
            ":delivered": "delivered",
            ":eventAt": eventAt,
            ":recipientId": status.recipient_id,
            ":now": new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return;
      throw error;
    }
    return;
  }

  if (status.status === "failed") {
    const parsed = parseDeliveryFailureError(status.errors);
    const sets = [
      "#status = :failed",
      "failureKind = :delivery",
      "failedAt = :eventAt",
      "deliveryErrorMessage = :msg",
      "waRecipientId = :recipientId",
    ];
    const exprValues: Record<string, unknown> = {
      ":failed": "delivery_failed",
      ":delivery": "delivery",
      ":eventAt": eventAt,
      ":msg": parsed.errorMessage,
      ":recipientId": status.recipient_id,
      ":sent": "sent",
      ":delivered": "delivered",
      ":now": new Date().toISOString(),
    };
    if (parsed.errorCode != null) {
      sets.push("deliveryErrorCode = :code");
      exprValues[":code"] = parsed.errorCode;
    }
    if (parsed.errorTitle) {
      sets.push("deliveryErrorTitle = :title");
      exprValues[":title"] = parsed.errorTitle;
    }
    sets.push("waMessageId = :waMessageId");
    exprValues[":waMessageId"] = status.id;

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: attemptKeys(tenantId, campaignId, attemptId),
          UpdateExpression: `SET ${sets.join(", ")}, updatedAt = :now`,
          ConditionExpression: "#status IN (:sent, :delivered)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: exprValues,
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return;
      throw error;
    }
  }
}

export async function applySmsDlrToAttempt(
  tenantId: string,
  campaignId: string,
  attemptId: string,
  callback: TelcoredDlrCallback,
  receipt: SmsDlrReceipt
): Promise<void> {
  const sets: string[] = [];
  const exprValues: Record<string, unknown> = {
    ":sent": "sent",
    ":now": new Date().toISOString(),
  };

  if (callback.messageId ?? receipt.telcoredMessageId) {
    sets.push("telcoredMessageId = :telcoredMessageId");
    exprValues[":telcoredMessageId"] = callback.messageId ?? receipt.telcoredMessageId;
    sets.push("externalMessageId = :externalMessageId");
    exprValues[":externalMessageId"] = callback.messageId ?? receipt.telcoredMessageId;
  }
  if (callback.sender) {
    sets.push("sender = :sender");
    exprValues[":sender"] = callback.sender;
  }
  if (callback.sentAt) {
    sets.push("sentAt = :sentAt");
    exprValues[":sentAt"] = callback.sentAt;
  }
  if (callback.cost) {
    sets.push("cost = :cost");
    exprValues[":cost"] = callback.cost;
  }
  if (callback.status) {
    sets.push("deliveryStatus = :deliveryStatus");
    exprValues[":deliveryStatus"] = callback.status;
  }
  if (callback.dlrAt) {
    sets.push("dlrAt = :dlrAt");
    exprValues[":dlrAt"] = callback.dlrAt;
  }
  if (callback.part) {
    sets.push("part = :part");
    exprValues[":part"] = callback.part;
  }
  if (callback.errorCode) {
    sets.push("smsErrorCode = :smsErrorCode");
    exprValues[":smsErrorCode"] = callback.errorCode;
  }

  const deliveryCode = callback.deliveryCode;
  if (deliveryCode !== undefined) {
    sets.push("lastDeliveryCode = :deliveryCode");
    exprValues[":deliveryCode"] = deliveryCode;
    if (deliveryCode === 4) {
      sets.push("lastIntermediateCode = :deliveryCode");
    }
    if (deliveryCode === 1 || deliveryCode === 2 || deliveryCode === 16) {
      sets.push("finalDeliveryCode = :deliveryCode");
    }
  }

  const code = deliveryCode;
  if (code === 1) {
    sets.push("#status = :delivered");
    exprValues[":delivered"] = "delivered";
    if (callback.dlrAt) {
      sets.push("deliveredAt = :dlrAt");
    } else {
      sets.push("deliveredAt = :nowDelivered");
      exprValues[":nowDelivered"] = new Date().toISOString();
    }
  } else if (code === 2 || code === 16) {
    sets.push("#status = :deliveryFailed");
    sets.push("failureKind = :delivery");
    sets.push("failedAt = :failedAt");
    sets.push("deliveryErrorMessage = :deliveryMsg");
    exprValues[":deliveryFailed"] = "delivery_failed";
    exprValues[":delivery"] = "delivery";
    exprValues[":failedAt"] = callback.dlrAt ?? new Date().toISOString();
    exprValues[":deliveryMsg"] =
      callback.status ??
      callback.errorCode ??
      (code === 16 ? "No se pudo entregar a la operadora final" : "Entrega fallida");
    if (callback.errorCode) {
      sets.push("deliveryErrorTitle = :deliveryTitle");
      sets.push("deliveryErrorCode = :deliveryCodeNum");
      exprValues[":deliveryTitle"] = callback.status ?? "SMS delivery failed";
      const parsed = Number.parseInt(callback.errorCode, 10);
      if (!Number.isNaN(parsed)) {
        exprValues[":deliveryCodeNum"] = parsed;
      }
    }
  }

  if (sets.length === 0) return;

  const statusSet = sets.some((s) => s.startsWith("#status"));
  const exprNames = statusSet ? { "#status": "status" } : undefined;

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: attemptKeys(tenantId, campaignId, attemptId),
        UpdateExpression: `SET ${sets.join(", ")}, updatedAt = :now`,
        ConditionExpression: statusSet ? "#status = :sent" : undefined,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
      })
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return;
    throw error;
  }
}

export async function listCampaignSendAttempts(
  tenantId: string,
  campaignId: string
): Promise<CampaignSendAttempt[]> {
  const items: CampaignSendAttempt[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `TENANT#${tenantId}`,
          ":sk": `CAMPATT#${campaignId}#`,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items ?? []) {
      items.push(stripAttemptItem(item));
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}
