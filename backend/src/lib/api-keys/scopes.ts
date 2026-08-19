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
  voiceCallsInitiate: "voice:calls:initiate",
  voiceCallsRead: "voice:calls:read",
  voiceCallsManage: "voice:calls:manage",
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

export const OPTIONAL_API_KEY_SCOPES = [
  API_KEY_SCOPES.voiceCallsInitiate,
  API_KEY_SCOPES.voiceCallsRead,
  API_KEY_SCOPES.voiceCallsManage,
];

export const ALL_API_KEY_SCOPES = [...DEFAULT_API_KEY_SCOPES, ...OPTIONAL_API_KEY_SCOPES];

const ALL_SCOPE_SET = new Set<string>(ALL_API_KEY_SCOPES);
const OPTIONAL_SCOPE_SET = new Set<string>(OPTIONAL_API_KEY_SCOPES);

export function mergeDefaultScopes(scopes: string[]): string[] {
  const merged = new Set([...scopes, ...DEFAULT_API_KEY_SCOPES]);
  return [...merged];
}

export function hasAllDefaultScopes(scopes: string[]): boolean {
  return DEFAULT_API_KEY_SCOPES.every((scope) => scopes.includes(scope));
}

export function validateAndNormalizeScopes(scopes: string[]): string[] {
  const unknown = scopes.filter((scope) => !ALL_SCOPE_SET.has(scope));
  if (unknown.length > 0) {
    throw Object.assign(new Error(`Unknown API key scopes: ${unknown.join(", ")}`), {
      statusCode: 400,
    });
  }

  const normalized: string[] = [...DEFAULT_API_KEY_SCOPES];
  for (const scope of scopes) {
    if (OPTIONAL_SCOPE_SET.has(scope) && !normalized.includes(scope)) {
      normalized.push(scope);
    }
  }
  return normalized;
}
