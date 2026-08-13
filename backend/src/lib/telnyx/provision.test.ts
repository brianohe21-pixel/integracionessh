import {
  assignTelnyxPhoneNumbers,
  buildTelnyxAppName,
  buildTelnyxWebhookUrl,
  ensureTelnyxCallControlApp,
  ensureTelnyxOutboundVoiceProfile,
} from "./provision.js";

function mockOutboundProfilesFetch() {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        data: [{ id: "ovp-1", name: "default", enabled: true }],
      }),
  };
}

describe("telnyx provision", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("builds tenant webhook url", () => {
    expect(buildTelnyxWebhookUrl("tenant-1", "https://api.example.com/")).toBe(
      "https://api.example.com/telephony/webhook/tenant-1"
    );
    expect(buildTelnyxAppName("tenant-1")).toBe("integracionessh-tenant-1");
  });

  it("reuses an enabled outbound voice profile", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(mockOutboundProfilesFetch()) as unknown as typeof fetch;

    await expect(
      ensureTelnyxOutboundVoiceProfile({ apiKey: "KEY1234567890", tenantId: "tenant-1" })
    ).resolves.toEqual({ outboundVoiceProfileId: "ovp-1" });
  });

  it("updates an existing call control app", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockOutboundProfilesFetch())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: "app-1", application_name: "integracionessh-tenant-1" }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { id: "app-1" } }),
      }) as unknown as typeof fetch;

    const result = await ensureTelnyxCallControlApp({
      apiKey: "KEY1234567890",
      tenantId: "tenant-1",
      apiBaseUrl: "https://api.example.com",
    });

    expect(result).toEqual({ connectionId: "app-1" });
    const patchCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(JSON.parse(String(patchCall[1]?.body))).toMatchObject({
      outbound: { outbound_voice_profile_id: "ovp-1" },
    });
  });

  it("creates a call control app when none exists", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockOutboundProfilesFetch())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { id: "app-new" } }),
      }) as unknown as typeof fetch;

    const result = await ensureTelnyxCallControlApp({
      apiKey: "KEY1234567890",
      tenantId: "tenant-2",
      apiBaseUrl: "https://api.example.com",
    });

    expect(result).toEqual({ connectionId: "app-new" });
    const createCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(JSON.parse(String(createCall[1]?.body))).toMatchObject({
      outbound: { outbound_voice_profile_id: "ovp-1" },
    });
  });

  it("assigns phone numbers to the connection", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [
              { id: "num-1", connection_id: null },
              { id: "num-2", connection_id: "conn-1" },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { id: "num-1" } }),
      }) as unknown as typeof fetch;

    await expect(
      assignTelnyxPhoneNumbers({ apiKey: "KEY1234567890", connectionId: "conn-1" })
    ).resolves.toBe(1);
  });
});
