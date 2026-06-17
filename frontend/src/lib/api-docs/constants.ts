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
] as const;
