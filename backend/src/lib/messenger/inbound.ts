import type { InboundNormalized, MessengerInboundPayload } from "../../types/index.js";
import { normalizeInstagramMessage } from "../instagram/inbound.js";
import { isProcessableInstagramMessage } from "../instagram/inbound.js";

export function isProcessableMessengerMessage(payload: MessengerInboundPayload): boolean {
  return isProcessableInstagramMessage(payload.message);
}

export function normalizeMessengerMessage(payload: MessengerInboundPayload): InboundNormalized {
  return normalizeInstagramMessage(payload.message);
}
