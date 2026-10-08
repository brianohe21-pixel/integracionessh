import {
  exchangeForLongLivedUserToken,
  exchangeInstagramCodeForToken,
  listInstagramPagesForUser,
  selectInstagramPage,
} from "./login-for-business.js";

describe("instagram login for business", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("exchanges authorization code for user token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "short-token" }),
    }) as typeof fetch;

    await expect(exchangeInstagramCodeForToken("auth-code", "app", "secret")).resolves.toBe(
      "short-token"
    );
  });

  it("exchanges short-lived token for long-lived token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "long-token" }),
    }) as typeof fetch;

    await expect(exchangeForLongLivedUserToken("short-token", "app", "secret")).resolves.toBe(
      "long-token"
    );
  });

  it("lists only pages with linked Instagram accounts", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "page-1",
            name: "Page One",
            access_token: "pat-1",
            instagram_business_account: { id: "ig-1", username: "one" },
          },
          {
            id: "page-2",
            name: "Page Two",
            access_token: "pat-2",
          },
        ],
      }),
    }) as typeof fetch;

    const pages = await listInstagramPagesForUser("user-token");
    expect(pages).toEqual([
      {
        pageId: "page-1",
        pageName: "Page One",
        pageAccessToken: "pat-1",
        instagramAccountId: "ig-1",
        instagramUsername: "one",
      },
    ]);
  });

  it("selects a single page automatically", () => {
    const result = selectInstagramPage([
      {
        pageId: "page-1",
        pageName: "Page One",
        pageAccessToken: "pat-1",
        instagramAccountId: "ig-1",
      },
    ]);
    expect(result.status).toBe("ready");
  });

  it("asks for selection when multiple pages are granted", () => {
    const result = selectInstagramPage([
      {
        pageId: "page-1",
        pageName: "Page One",
        pageAccessToken: "pat-1",
        instagramAccountId: "ig-1",
      },
      {
        pageId: "page-2",
        pageName: "Page Two",
        pageAccessToken: "pat-2",
        instagramAccountId: "ig-2",
      },
    ]);
    expect(result.status).toBe("needs_selection");
  });
});
