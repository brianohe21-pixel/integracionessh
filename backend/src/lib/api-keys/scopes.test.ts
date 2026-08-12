import {
  API_KEY_SCOPES,
  DEFAULT_API_KEY_SCOPES,
  hasAllDefaultScopes,
  mergeDefaultScopes,
  validateAndNormalizeScopes,
} from "./scopes.js";

describe("mergeDefaultScopes", () => {
  it("adds missing template scopes to legacy keys", () => {
    const legacy = [
      API_KEY_SCOPES.messagesSend,
      API_KEY_SCOPES.callsInitiate,
      API_KEY_SCOPES.callsManage,
      API_KEY_SCOPES.callsSettings,
    ];
    const merged = mergeDefaultScopes(legacy);
    expect(merged).toEqual(expect.arrayContaining(DEFAULT_API_KEY_SCOPES));
    expect(merged).toHaveLength(DEFAULT_API_KEY_SCOPES.length);
  });

  it("includes sms scopes in default scopes", () => {
    expect(DEFAULT_API_KEY_SCOPES).toEqual(
      expect.arrayContaining([API_KEY_SCOPES.smsSend, API_KEY_SCOPES.smsRead])
    );
  });

  it("keeps keys that already have all default scopes unchanged", () => {
    const scopes = [...DEFAULT_API_KEY_SCOPES];
    expect(mergeDefaultScopes(scopes)).toEqual(scopes);
    expect(hasAllDefaultScopes(scopes)).toBe(true);
  });

  it("does not add optional voice scopes to legacy keys", () => {
    const legacy = [
      API_KEY_SCOPES.messagesSend,
      API_KEY_SCOPES.callsInitiate,
      API_KEY_SCOPES.callsManage,
      API_KEY_SCOPES.callsSettings,
    ];
    const merged = mergeDefaultScopes(legacy);
    expect(merged).not.toContain(API_KEY_SCOPES.voiceCallsInitiate);
    expect(merged).not.toContain(API_KEY_SCOPES.voiceCallsRead);
    expect(merged).not.toContain(API_KEY_SCOPES.voiceCallsManage);
  });

  it("adds optional voice scopes only when requested", () => {
    const scopes = validateAndNormalizeScopes([
      ...DEFAULT_API_KEY_SCOPES,
      API_KEY_SCOPES.voiceCallsRead,
    ]);
    expect(scopes).toContain(API_KEY_SCOPES.voiceCallsRead);
    expect(scopes).not.toContain(API_KEY_SCOPES.voiceCallsInitiate);
  });

  it("rejects unknown scopes", () => {
    expect(() => validateAndNormalizeScopes(["unknown:scope"])).toThrow(/Unknown API key scopes/);
  });
});
