import {
  CALLING_SETTINGS_UNAVAILABLE_MESSAGE,
  CallingSettingsUnavailableError,
  DISABLED_CALLING_SETTINGS,
  getCallSettings,
  getCallSettingsForBot,
  isCoexistenceCallingBot,
  updateCallSettings,
} from "./calls.js";

describe("whatsapp calling settings", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("detects coexistence bots", () => {
    expect(isCoexistenceCallingBot({ whatsappOnboardingMode: "coexistence" })).toBe(true);
    expect(isCoexistenceCallingBot({ whatsappOnboardingMode: "cloud_api" })).toBe(false);
    expect(isCoexistenceCallingBot({})).toBe(false);
  });

  it("skips Meta for coexistence bots", async () => {
    global.fetch = jest.fn() as typeof fetch;
    const settings = await getCallSettingsForBot(
      { phoneNumberId: "123", whatsappOnboardingMode: "coexistence" },
      "token"
    );
    expect(settings).toEqual(DISABLED_CALLING_SETTINGS);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns disabled settings when Meta has no settings edge", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            message: "(#100) Tried accessing nonexisting field (settings)",
            type: "OAuthException",
            code: 100,
          },
        }),
    }) as typeof fetch;

    const settings = await getCallSettingsForBot({ phoneNumberId: "123" }, "token");
    expect(settings).toEqual(DISABLED_CALLING_SETTINGS);
  });

  it("maps Meta settings field error on update", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            message: "(#100) Tried accessing nonexisting field (settings)",
            code: 100,
          },
        }),
    }) as typeof fetch;

    await expect(
      updateCallSettings("123", "token", { calling: { status: "ENABLED" } })
    ).rejects.toMatchObject({
      name: "CallingSettingsUnavailableError",
      statusCode: 400,
      message: CALLING_SETTINGS_UNAVAILABLE_MESSAGE,
    });
  });

  it("rejects empty phone number ids", async () => {
    await expect(getCallSettings("  ", "token")).rejects.toBeInstanceOf(
      CallingSettingsUnavailableError
    );
  });
});
