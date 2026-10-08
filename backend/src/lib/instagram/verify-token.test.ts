import { verifyInstagramPageToken } from "./verify-token.js";

describe("verifyInstagramPageToken", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves page and linked Instagram business account", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "1103969472795101",
        name: "Integracionessh",
        instagram_business_account: { id: "17841400000000000", username: "integracionessh" },
      }),
    }) as typeof fetch;

    const result = await verifyInstagramPageToken("page-token");
    expect(result).toEqual({
      pageId: "1103969472795101",
      pageName: "Integracionessh",
      instagramAccountId: "17841400000000000",
      instagramUsername: "integracionessh",
    });
  });

  it("rejects pages without a linked Instagram account", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1103969472795101", name: "Integracionessh" }),
    }) as typeof fetch;

    await expect(verifyInstagramPageToken("page-token")).rejects.toThrow(
      /no linked Instagram Business/
    );
  });

  it("rejects tokens from a different meta app", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "1103969472795101",
          name: "Integracionessh",
          instagram_business_account: { id: "17841400000000000" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { message: "App_id in the input_token did not match the Viewing App" },
        }),
      }) as typeof fetch;

    await expect(
      verifyInstagramPageToken("page-token", {
        metaAppId: "4505851696405995",
        metaAppSecret: "secret",
      })
    ).rejects.toThrow(/platform Meta app/);
  });
});
