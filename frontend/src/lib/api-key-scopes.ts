export const DEFAULT_API_KEY_SCOPES = [
  "messages:send",
  "sms:send",
  "sms:read",
  "calls:initiate",
  "calls:manage",
  "calls:settings",
  "templates:read",
  "templates:write",
] as const;

export const OPTIONAL_VOICE_API_KEY_SCOPES = [
  "voice:calls:initiate",
  "voice:calls:read",
  "voice:calls:manage",
] as const;

export const ALL_API_KEY_SCOPES = [
  ...DEFAULT_API_KEY_SCOPES,
  ...OPTIONAL_VOICE_API_KEY_SCOPES,
] as const;

export function buildApiKeyScopes(selectedVoiceScopes: string[]): string[] {
  const voice = selectedVoiceScopes.filter((scope) =>
    OPTIONAL_VOICE_API_KEY_SCOPES.includes(
      scope as (typeof OPTIONAL_VOICE_API_KEY_SCOPES)[number]
    )
  );
  return [...DEFAULT_API_KEY_SCOPES, ...voice];
}

export function getSelectedVoiceScopes(scopes: string[]): string[] {
  return scopes.filter((scope) =>
    OPTIONAL_VOICE_API_KEY_SCOPES.includes(
      scope as (typeof OPTIONAL_VOICE_API_KEY_SCOPES)[number]
    )
  );
}
