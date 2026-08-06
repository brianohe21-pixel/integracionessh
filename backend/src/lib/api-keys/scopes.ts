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
  smsSend: "sms:send",
  smsRead: "sms:read",
  callsInitiate: "calls:initiate",
  callsManage: "calls:manage",
  callsSettings: "calls:settings",
  templatesRead: "templates:read",
  templatesWrite: "templates:write",
} as const;

export const DEFAULT_API_KEY_SCOPES = [
  API_KEY_SCOPES.messagesSend,
  API_KEY_SCOPES.smsSend,
  API_KEY_SCOPES.smsRead,
  API_KEY_SCOPES.callsInitiate,
  API_KEY_SCOPES.callsManage,
  API_KEY_SCOPES.callsSettings,
  API_KEY_SCOPES.templatesRead,
  API_KEY_SCOPES.templatesWrite,
];

export function mergeDefaultScopes(scopes: string[]): string[] {
  const merged = new Set([...scopes, ...DEFAULT_API_KEY_SCOPES]);
  return [...merged];
}

export function hasAllDefaultScopes(scopes: string[]): boolean {
  return DEFAULT_API_KEY_SCOPES.every((scope) => scopes.includes(scope));
}
