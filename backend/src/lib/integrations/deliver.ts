import { assertSafeUrl, buildSignature } from "../webhook/client.js";
import type { IntegrationEventPayload, TenantIntegration } from "../../types/index.js";

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export async function deliverIntegrationEvent(
  integration: TenantIntegration,
  payload: IntegrationEventPayload
): Promise<void> {
  await assertSafeUrl(integration.webhookUrl);

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "IntegracionesSSH/1.0",
    "X-Integration-Event": payload.event,
  };

  if (integration.webhookSecret) {
    headers["X-Integration-Signature"] = buildSignature(integration.webhookSecret, body);
  }

  const response = await fetch(integration.webhookUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Integration webhook returned HTTP ${response.status}`);
  }
}

export function shouldRetryDelivery(attempt: number): boolean {
  return attempt < MAX_ATTEMPTS;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000);
}
