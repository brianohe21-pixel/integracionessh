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
  failureKind: SmsTraceFailureKind | null;
  externalMessageId: string | null;
  telcoredMessageId: string | null;
  sendErrorMessage: string | null;
  deliveryErrorCode: string | null;
  deliveryErrorMessage: string | null;
  deliveryStatus: string | null;
  finalDeliveryCode: number | null;
  lastIntermediateCode: number | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  dlrAt: string | null;
  cost: string | null;
  part: string | null;
  sender: string | null;
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
): SmsTraceFailureKind | null {
  if (status === "send_failed") return "send";
  if (status === "delivery_failed") return "delivery";
  return null;
}

export function mapSmsDlrReceiptToTraceability(receipt: SmsDlrReceipt): SmsTraceability {
  const status = deriveSmsTraceStatus(receipt);
  const failureKind = deriveSmsTraceFailureKind(status);
  const failedAt =
    status === "send_failed"
      ? receipt.updatedAt
      : status === "delivery_failed"
        ? receipt.dlrAt ?? receipt.updatedAt
        : null;

  return {
    traceId: receipt.receiptId,
    phone: receipt.to,
    channel: "sms",
    status,
    failureKind,
    externalMessageId: receipt.telcoredMessageId ?? null,
    telcoredMessageId: receipt.telcoredMessageId ?? null,
    sendErrorMessage: receipt.sendError ?? null,
    deliveryErrorCode: receipt.errorCode ?? null,
    deliveryErrorMessage:
      status === "delivery_failed" ? receipt.deliveryStatus ?? null : null,
    deliveryStatus: receipt.deliveryStatus ?? null,
    finalDeliveryCode: receipt.finalDeliveryCode ?? null,
    lastIntermediateCode: receipt.lastIntermediateCode ?? null,
    sentAt: receipt.sentAt ?? null,
    deliveredAt: status === "delivered" ? receipt.dlrAt ?? null : null,
    failedAt,
    dlrAt: receipt.dlrAt ?? null,
    cost: receipt.cost ?? null,
    part: receipt.part ?? null,
    sender: receipt.sender ?? null,
    requestDlr: true,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };
}
