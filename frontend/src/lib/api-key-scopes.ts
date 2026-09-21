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

export const OPTIONAL_OTP_API_KEY_SCOPES = ["otp:send", "otp:verify"] as const;

export const ALL_OPTIONAL_API_KEY_SCOPES = [
  ...OPTIONAL_VOICE_API_KEY_SCOPES,
  ...OPTIONAL_OTP_API_KEY_SCOPES,
] as const;

export const ALL_API_KEY_SCOPES = [
  ...DEFAULT_API_KEY_SCOPES,
  ...ALL_OPTIONAL_API_KEY_SCOPES,
] as const;

type OptionalScope = (typeof ALL_OPTIONAL_API_KEY_SCOPES)[number];

function isOptionalScope(scope: string): scope is OptionalScope {
  return ALL_OPTIONAL_API_KEY_SCOPES.includes(scope as OptionalScope);
}

export function buildApiKeyScopes(selectedOptionalScopes: string[]): string[] {
  const optional = selectedOptionalScopes.filter(isOptionalScope);
  return [...DEFAULT_API_KEY_SCOPES, ...optional];
}

export function getSelectedOptionalScopes(scopes: string[]): string[] {
  return scopes.filter(isOptionalScope);
}

export function getSelectedVoiceScopes(scopes: string[]): string[] {
  return scopes.filter((scope) =>
    OPTIONAL_VOICE_API_KEY_SCOPES.includes(
      scope as (typeof OPTIONAL_VOICE_API_KEY_SCOPES)[number]
    )
  );
}

export function getSelectedOtpScopes(scopes: string[]): string[] {
  return scopes.filter((scope) =>
    OPTIONAL_OTP_API_KEY_SCOPES.includes(scope as (typeof OPTIONAL_OTP_API_KEY_SCOPES)[number])
  );
}
