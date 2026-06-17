import { API_KEY_PLACEHOLDER, getApiBaseUrl } from "./constants";

export function buildCurlExample(params: {
  method: "GET" | "POST" | "PUT";
  path: string;
  apiKey?: string;
  body?: string;
}): string {
  const base = getApiBaseUrl();
  const key = params.apiKey ?? API_KEY_PLACEHOLDER;
  const lines = [
    `curl -X ${params.method} \\`,
    `  ${base}${params.path} \\`,
    `  -H "X-API-Key: ${key}"`,
  ];

  if (params.method !== "GET") {
    lines.push(`  -H "Content-Type: application/json"`);
  }

  if (params.body) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -d '${params.body}'`);
  }

  return lines.join("\n");
}

export function buildSendMessageCurlExample(apiKey?: string): string {
  return buildCurlExample({
    method: "POST",
    path: "/v1/messages",
    apiKey,
    body: '{"to":"521234567890","type":"text","text":"Hello!"}',
  });
}

export const CALLS_ENDPOINT_HINT =
  "POST /v1/calls · GET /v1/calls/permission/{userWaId} · POST /v1/calls/{callId}";
