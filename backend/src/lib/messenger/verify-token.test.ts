import { verifyMessengerPageToken } from "./verify-token.js";

describe("verifyMessengerPageToken", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves page id from token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1103969472795101", name: "Integracionessh" }),
    }) as typeof fetch;

    const result = await verifyMessengerPageToken("page-token");
    expect(result).toEqual({
      pageId: "1103969472795101",
      pageName: "Integracionessh",
    });
  });

  it("rejects when expected page id does not match token page", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1103969472795101", name: "Integracionessh" }),
    }) as typeof fetch;

    await expect(
      verifyMessengerPageToken("page-token", { expectedPageId: "1388999023121741" })
    ).rejects.toThrow(/Page ID mismatch/);
  });

  it("rejects tokens from a different meta app", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "1103969472795101", name: "Integracionessh" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { message: "App_id in the input_token did not match the Viewing App" },
        }),
      }) as typeof fetch;

    await expect(
      verifyMessengerPageToken("page-token", {
        metaAppId: "4505851696405995",
        metaAppSecret: "secret",
      })
    ).rejects.toThrow(/platform Meta app/);
  });
});
