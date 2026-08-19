export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "https://api.integracionessh.lat").replace(/\/$/, "");
}

export const API_KEY_PLACEHOLDER = "YOUR_API_KEY";

export const API_SCOPES = [
  {
    scope: "messages:send",
    endpoints: ["POST /v1/messages"],
  },
  {
    scope: "sms:send",
    endpoints: ["POST /v1/sms"],
  },
  {
    scope: "sms:read",
    endpoints: ["GET /v1/sms/{traceId}"],
  },
  {
    scope: "templates:read",
    endpoints: ["GET /v1/templates"],
  },
  {
    scope: "templates:write",
    endpoints: ["POST /v1/templates", "PUT /v1/templates/{name}", "DELETE /v1/templates/{name}"],
  },
  {
    scope: "calls:initiate",
    endpoints: [
      "POST /v1/calls",
      "POST /v1/calls/permission-request",
      "GET /v1/calls/permission/{userWaId}",
    ],
  },
  {
    scope: "calls:manage",
    endpoints: ["POST /v1/calls/{callId}", "GET /v1/calls/{callId}"],
  },
  {
    scope: "calls:settings",
    endpoints: ["GET /v1/calls/settings", "PUT /v1/calls/settings"],
  },
  {
    scope: "voice:calls:initiate",
    endpoints: ["POST /v1/voice/calls"],
  },
  {
    scope: "voice:calls:read",
    endpoints: [
      "GET /v1/voice/calls",
      "GET /v1/voice/calls/{callId}",
      "GET /v1/voice/calls/{callId}/events",
      "GET /v1/voice/calls/{callId}/transcript",
      "GET /v1/voice/calls/{callId}/recording",
    ],
  },
  {
    scope: "voice:calls:manage",
    endpoints: ["POST /v1/voice/calls/{callId}/end"],
  },
] as const;
