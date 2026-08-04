export const TELCORED_DLR_QUERY_TEMPLATE =
  "receiptId={receiptId}&messageId=%i&deliveryCode=%d&sender=%P&recipient=%p&sentAt=%t&cost=%c&status=%s&dlrAt=%y&part=%n&errorCode=%j";

export type TelcoredDeliveryCode = 1 | 2 | 4 | 16;

export interface TelcoredDlrCallback {
  receiptId: string;
  messageId?: string;
  deliveryCode?: number;
  sender?: string;
  recipient?: string;
  sentAt?: string;
  cost?: string;
  status?: string;
  dlrAt?: string;
  part?: string;
  errorCode?: string;
}

export function resolveApiPublicUrl(): string | null {
  const raw = process.env.API_PUBLIC_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function assertApiPublicUrlConfigured(): string {
  const url = resolveApiPublicUrl();
  if (!url) {
    throw Object.assign(
      new Error("API_PUBLIC_URL is not configured for SMS delivery receipts"),
      { statusCode: 503 }
    );
  }
  return url;
}

export function buildTelcoredDlrUrl(receiptId: string, apiPublicUrl: string): string {
  const base = apiPublicUrl.replace(/\/$/, "");
  const query = TELCORED_DLR_QUERY_TEMPLATE.replace("{receiptId}", receiptId);
  return `${base}/sms/dlr?${query}`;
}

export function parseTelcoredDeliveryCode(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isFinalTelcoredDeliveryCode(code: number | undefined): code is 1 | 2 | 16 {
  return code === 1 || code === 2 || code === 16;
}

export function isIntermediateTelcoredDeliveryCode(code: number | undefined): code is 4 {
  return code === 4;
}

export function parseTelcoredDlrQuery(
  params: Record<string, string | undefined>
): TelcoredDlrCallback | null {
  const receiptId = params.receiptId?.trim();
  if (!receiptId) return null;

  const callback: TelcoredDlrCallback = { receiptId };
  if (params.messageId?.trim()) callback.messageId = params.messageId.trim();
  const deliveryCode = parseTelcoredDeliveryCode(params.deliveryCode ?? params.estado);
  if (deliveryCode !== undefined) callback.deliveryCode = deliveryCode;
  if (params.sender?.trim()) callback.sender = params.sender.trim();
  if (params.recipient?.trim()) callback.recipient = params.recipient.trim();
  if (params.sentAt?.trim()) callback.sentAt = params.sentAt.trim();
  if (params.cost?.trim()) callback.cost = params.cost.trim();
  if (params.status?.trim()) callback.status = params.status.trim();
  if (params.dlrAt?.trim()) callback.dlrAt = params.dlrAt.trim();
  if (params.part?.trim()) callback.part = params.part.trim();
  if (params.errorCode?.trim()) callback.errorCode = params.errorCode.trim();

  return callback;
}
