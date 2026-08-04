import { randomUUID } from "crypto";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import {
  isFinalTelcoredDeliveryCode,
  isIntermediateTelcoredDeliveryCode,
  type TelcoredDlrCallback,
} from "../sms/dlr.js";
import { incrementCampaignAnalytics } from "./campaign.repository.js";
import { recordBulkSendFailure } from "./bulk-job.repository.js";
import type { SmsDlrReceipt, SmsDlrSource } from "../../types/index.js";

const RECEIPT_TTL_SECONDS = 30 * 24 * 60 * 60;

function receiptKeys(receiptId: string) {
  return {
    PK: `SMSDLR#${receiptId}`,
    SK: `SMSDLR#${receiptId}`,
  };
}

export function makeSmsDlrReceiptId(): string {
  return randomUUID();
}

export async function createSmsDlrReceipt(
  input: Omit<SmsDlrReceipt, "receiptId" | "createdAt" | "updatedAt" | "metricsApplied"> & {
    receiptId?: string;
  }
): Promise<SmsDlrReceipt> {
  const now = new Date().toISOString();
  const receipt: SmsDlrReceipt = {
    receiptId: input.receiptId ?? makeSmsDlrReceiptId(),
    tenantId: input.tenantId,
    botId: input.botId,
    source: input.source,
    to: input.to,
    metricsApplied: false,
    createdAt: now,
    updatedAt: now,
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    ...(input.templateName ? { templateName: input.templateName } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.telcoredMessageId ? { telcoredMessageId: input.telcoredMessageId } : {}),
    ...(input.sendError ? { sendError: input.sendError } : {}),
  };

  const ttl = Math.floor(Date.now() / 1000) + RECEIPT_TTL_SECONDS;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...receiptKeys(receipt.receiptId),
        ...receipt,
        ttl,
      },
    })
  );

  return receipt;
}

export async function getSmsDlrReceipt(receiptId: string): Promise<SmsDlrReceipt | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: receiptKeys(receiptId),
    })
  );

  if (!result.Item) return null;
  const { PK, SK, ttl: _ttl, ...rest } = result.Item;
  return rest as SmsDlrReceipt;
}

export async function markSmsDlrReceiptSent(
  receiptId: string,
  telcoredMessageId: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: receiptKeys(receiptId),
      UpdateExpression: "SET telcoredMessageId = :messageId, updatedAt = :now",
      ExpressionAttributeValues: {
        ":messageId": telcoredMessageId,
        ":now": now,
      },
    })
  );
}

export async function markSmsDlrReceiptSendError(
  receiptId: string,
  sendError: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: receiptKeys(receiptId),
      UpdateExpression: "SET sendError = :sendError, updatedAt = :now",
      ExpressionAttributeValues: {
        ":sendError": sendError,
        ":now": now,
      },
    })
  );
}

async function tryClaimSmsDlrMetrics(receiptId: string): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: receiptKeys(receiptId),
        UpdateExpression: "SET metricsApplied = :true, updatedAt = :now",
        ConditionExpression: "attribute_not_exists(metricsApplied) OR metricsApplied = :false",
        ExpressionAttributeValues: {
          ":true": true,
          ":false": false,
          ":now": now,
        },
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return false;
    }
    throw error;
  }
}

async function applyCampaignDlrMetrics(
  receipt: SmsDlrReceipt,
  callback: TelcoredDlrCallback
): Promise<void> {
  if (receipt.source !== "campaign" || !receipt.campaignId) return;

  const claimed = await tryClaimSmsDlrMetrics(receipt.receiptId);
  if (!claimed) return;

  const code = callback.deliveryCode;
  if (code === 1) {
    await incrementCampaignAnalytics(receipt.tenantId, receipt.campaignId, "deliveredCount");
    return;
  }

  if (code === 2 || code === 16) {
    const detail =
      callback.status ??
      callback.errorCode ??
      (code === 16 ? "No se pudo entregar a la operadora final" : "Entrega fallida");
    await Promise.all([
      incrementCampaignAnalytics(receipt.tenantId, receipt.campaignId, "deliveryFailed"),
      recordBulkSendFailure(receipt.tenantId, receipt.campaignId, "delivery", {
        to: callback.recipient ?? receipt.to,
        errorMessage: detail,
        errorTitle: callback.status ?? "SMS delivery failed",
        ...(callback.messageId ?? receipt.telcoredMessageId
          ? { messageId: callback.messageId ?? receipt.telcoredMessageId }
          : {}),
        ...(callback.errorCode ? { errorCode: Number.parseInt(callback.errorCode, 10) } : {}),
      }),
    ]);
  }
}

export async function applySmsDlrCallback(
  callback: TelcoredDlrCallback
): Promise<"updated" | "ignored" | "not_found"> {
  const receipt = await getSmsDlrReceipt(callback.receiptId);
  if (!receipt) return "not_found";

  const now = new Date().toISOString();
  const sets: string[] = ["updatedAt = :now"];
  const exprValues: Record<string, unknown> = { ":now": now };
  const exprNames: Record<string, string> = {};

  if (callback.messageId) {
    sets.push("telcoredMessageId = :messageId");
    exprValues[":messageId"] = callback.messageId;
  }
  if (callback.sender) {
    sets.push("sender = :sender");
    exprValues[":sender"] = callback.sender;
  }
  if (callback.recipient) {
    sets.push("#recipient = :recipient");
    exprNames["#recipient"] = "to";
    exprValues[":recipient"] = callback.recipient;
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
    sets.push("errorCode = :errorCode");
    exprValues[":errorCode"] = callback.errorCode;
  }

  const deliveryCode = callback.deliveryCode;
  if (deliveryCode !== undefined) {
    sets.push("lastDeliveryCode = :deliveryCode");
    exprValues[":deliveryCode"] = deliveryCode;
    if (isFinalTelcoredDeliveryCode(deliveryCode)) {
      sets.push("finalDeliveryCode = :deliveryCode");
    }
    if (isIntermediateTelcoredDeliveryCode(deliveryCode)) {
      sets.push("lastIntermediateCode = :deliveryCode");
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: receiptKeys(receipt.receiptId),
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: exprValues,
      ...(Object.keys(exprNames).length > 0 ? { ExpressionAttributeNames: exprNames } : {}),
    })
  );

  if (isFinalTelcoredDeliveryCode(deliveryCode)) {
    await applyCampaignDlrMetrics(receipt, callback);
  }

  return "updated";
}

export type { SmsDlrSource };
