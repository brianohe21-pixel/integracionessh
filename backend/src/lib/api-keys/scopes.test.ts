import {
  API_KEY_SCOPES,
  DEFAULT_API_KEY_SCOPES,
  hasAllDefaultScopes,
  mergeDefaultScopes,
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

  it("keeps keys that already have all default scopes unchanged", () => {
    const scopes = [...DEFAULT_API_KEY_SCOPES];
    expect(mergeDefaultScopes(scopes)).toEqual(scopes);
    expect(hasAllDefaultScopes(scopes)).toBe(true);
  });
});
