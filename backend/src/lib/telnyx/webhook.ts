import { createPublicKey, verify } from "crypto";

const MAX_SKEW_SECONDS = 300;

export function verifyTelnyxWebhookSignature(params: {
  rawBody: string;
  signature: string | undefined;
  timestamp: string | undefined;
  publicKey: string | undefined;
}): boolean {
  const { rawBody, signature, timestamp, publicKey } = params;
  if (!signature || !timestamp || !publicKey) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return false;

  const payload = `${timestamp}|${rawBody}`;
  const signatureBuffer = Buffer.from(signature, "base64");

  try {
    const key = createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(payload), key, signatureBuffer);
  } catch {
    return false;
  }
}

export interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: Record<string, unknown>;
    record_type?: string;
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
}

export function parseTelnyxWebhookBody(body: string): TelnyxWebhookEvent[] {
  const parsed = JSON.parse(body) as TelnyxWebhookEvent | TelnyxWebhookEvent[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function decodeTelnyxClientState(payload: Record<string, unknown>): {
  sessionId?: string;
  callId?: string;
  leg?: string;
} {
  const raw = String(payload.client_state ?? "");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as {
      sessionId?: string;
      callId?: string;
      leg?: string;
    };
    return {
      ...(parsed.sessionId ? { sessionId: parsed.sessionId } : {}),
      ...(parsed.callId ? { callId: parsed.callId } : {}),
      ...(parsed.leg ? { leg: parsed.leg } : {}),
    };
  } catch {
    return {};
  }
}
