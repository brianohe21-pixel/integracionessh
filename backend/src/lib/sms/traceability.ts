import type { SmsDlrReceipt } from "../../types/index.js";

export type SmsTraceStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "delivery_failed"
  | "send_failed";

export type SmsTraceFailureKind = "send" | "delivery";

export interface SmsTraceability {
  traceId: string;
  phone: string;
  channel: "sms";
  status: SmsTraceStatus;
  failureKind?: SmsTraceFailureKind;
  externalMessageId?: string;
  telcoredMessageId?: string;
  sendErrorMessage?: string;
  deliveryErrorCode?: string;
  deliveryErrorMessage?: string;
  deliveryStatus?: string;
  finalDeliveryCode?: number;
  lastIntermediateCode?: number;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  dlrAt?: string;
  cost?: string;
  part?: string;
  sender?: string;
  requestDlr: boolean;
  createdAt: string;
  updatedAt: string;
}

export function deriveSmsTraceStatus(receipt: SmsDlrReceipt): SmsTraceStatus {
  if (receipt.sendError) return "send_failed";
  if (receipt.finalDeliveryCode === 1) return "delivered";
  if (receipt.finalDeliveryCode === 2 || receipt.finalDeliveryCode === 16) {
    return "delivery_failed";
  }
  if (receipt.telcoredMessageId) return "sent";
  return "pending";
}

export function deriveSmsTraceFailureKind(
  status: SmsTraceStatus
): SmsTraceFailureKind | undefined {
  if (status === "send_failed") return "send";
  if (status === "delivery_failed") return "delivery";
  return undefined;
}

export function mapSmsDlrReceiptToTraceability(receipt: SmsDlrReceipt): SmsTraceability {
  const status = deriveSmsTraceStatus(receipt);
  const failureKind = deriveSmsTraceFailureKind(status);
  const failedAt =
    status === "send_failed"
      ? receipt.updatedAt
      : status === "delivery_failed"
        ? receipt.dlrAt ?? receipt.updatedAt
        : undefined;

  return {
    traceId: receipt.receiptId,
    phone: receipt.to,
    channel: "sms",
    status,
    ...(failureKind ? { failureKind } : {}),
    ...(receipt.telcoredMessageId
      ? {
          externalMessageId: receipt.telcoredMessageId,
          telcoredMessageId: receipt.telcoredMessageId,
        }
      : {}),
    ...(receipt.sendError ? { sendErrorMessage: receipt.sendError } : {}),
    ...(receipt.errorCode ? { deliveryErrorCode: receipt.errorCode } : {}),
    ...(status === "delivery_failed" && receipt.deliveryStatus
      ? { deliveryErrorMessage: receipt.deliveryStatus }
      : {}),
    ...(receipt.deliveryStatus ? { deliveryStatus: receipt.deliveryStatus } : {}),
    ...(receipt.finalDeliveryCode !== undefined
      ? { finalDeliveryCode: receipt.finalDeliveryCode }
      : {}),
    ...(receipt.lastIntermediateCode !== undefined
      ? { lastIntermediateCode: receipt.lastIntermediateCode }
      : {}),
    ...(receipt.sentAt ? { sentAt: receipt.sentAt } : {}),
    ...(status === "delivered" && receipt.dlrAt ? { deliveredAt: receipt.dlrAt } : {}),
    ...(failedAt ? { failedAt } : {}),
    ...(receipt.dlrAt ? { dlrAt: receipt.dlrAt } : {}),
    ...(receipt.cost ? { cost: receipt.cost } : {}),
    ...(receipt.part ? { part: receipt.part } : {}),
    ...(receipt.sender ? { sender: receipt.sender } : {}),
    requestDlr: true,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };
}
