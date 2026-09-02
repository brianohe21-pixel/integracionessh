export const FLOW_WEBHOOK_HEADERS = [
  "Content-Type: application/json",
  "X-Flow-Secret: {secret}",
  "Idempotency-Key: {optional_unique_key}",
] as const;

export const FLOW_WEBHOOK_RESPONSE_EXAMPLE = {
  submissionId: "sub_01h2x...",
  status: "accepted",
} as const;

export function buildFlowWebhookPayloadExample(
  samplePayload?: Record<string, unknown>
): Record<string, unknown> {
  if (samplePayload && Object.keys(samplePayload).length > 0) {
    return samplePayload;
  }
  return {
    phone: "573001234567",
    name: "Jane Doe",
    email: "jane@example.com",
  };
}

export function buildFlowWebhookCurlExample(
  webhookUrl: string,
  secret: string,
  payload: Record<string, unknown>
): string {
  const body = JSON.stringify(payload);
  return `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Flow-Secret: ${secret}' \\
  -d '${body}'`;
}

export function buildFlowWebhookCurlPlaceholder(
  payload: Record<string, unknown>
): string {
  const body = JSON.stringify(payload);
  return `curl -X POST 'https://api.example.com/public/flow-hooks/fhk_...' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Flow-Secret: fhs_...' \\
  -d '${body}'`;
}
