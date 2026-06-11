import type { ApiKey } from "../../types/index.js";

export function assertApiKeyScope(apiKey: ApiKey, scope: string): void {
  if (!apiKey.scopes.includes(scope)) {
    throw Object.assign(new Error(`API key missing required scope: ${scope}`), {
      statusCode: 403,
    });
  }
}

export const API_KEY_SCOPES = {
  messagesSend: "messages:send",
  callsInitiate: "calls:initiate",
  callsManage: "calls:manage",
  callsSettings: "calls:settings",
} as const;

export const DEFAULT_API_KEY_SCOPES = [
  API_KEY_SCOPES.messagesSend,
  API_KEY_SCOPES.callsInitiate,
  API_KEY_SCOPES.callsManage,
  API_KEY_SCOPES.callsSettings,
];
