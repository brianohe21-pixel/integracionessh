import { MailrelayApiError, MailrelayClient } from "./client.js";

const baseUrl = "https://example.ipzmarketing.com";

describe("MailrelayClient", () => {
  it("sends X-AUTH-TOKEN authentication and parses JSON", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ) as unknown as typeof fetch;
    const client = new MailrelayClient({ apiKey: "secret", baseUrl, fetcher });

    await expect(client.ping()).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://example.ipzmarketing.com/api/v1/ping"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-AUTH-TOKEN": "secret" }),
      })
    );
  });

  it("retries bounded server failures", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(new Response("failure", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7 }), { status: 200 })) as unknown as typeof fetch;
    const client = new MailrelayClient({
      apiKey: "secret",
      baseUrl,
      fetcher,
      maxRetries: 1,
    });

    await expect(client.request("GET", "/groups")).resolves.toEqual({ id: 7 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns structured API errors without retrying validation errors", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid subscriber" }), { status: 422 })
    ) as unknown as typeof fetch;
    const client = new MailrelayClient({ apiKey: "secret", baseUrl, fetcher });

    await expect(client.syncSubscriber({ email: "invalid" })).rejects.toEqual(
      expect.objectContaining<Partial<MailrelayApiError>>({
        statusCode: 422,
        message: "Invalid subscriber",
      })
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("formats Mailrelay field validation errors", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: {
            html: ["Your newsletter must include at least one link with an unsubscribe URL."],
          },
        }),
        { status: 422 }
      )
    ) as unknown as typeof fetch;
    const client = new MailrelayClient({ apiKey: "secret", baseUrl, fetcher });

    await expect(client.request("POST", "/campaigns", { body: { html: "<p>x</p>" } })).rejects.toEqual(
      expect.objectContaining<Partial<MailrelayApiError>>({
        statusCode: 422,
        message: "html: Your newsletter must include at least one link with an unsubscribe URL.",
      })
    );
  });

  it("reads pagination headers", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), {
        status: 200,
        headers: { Total: "3" },
      })
    ) as unknown as typeof fetch;
    const client = new MailrelayClient({ apiKey: "secret", baseUrl, fetcher });

    await expect(client.page("/groups", { page: 1, per_page: 2 })).resolves.toEqual({
      items: [{ id: 1 }, { id: 2 }],
      totalPages: 3,
      page: 1,
      perPage: 2,
      hasMore: true,
    });
  });
});
