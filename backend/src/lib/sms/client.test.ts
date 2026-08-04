import {
  isValidTelcoredSender,
  normalizeTelcoredSender,
  sendSmsTextMessage,
  shouldRegisterSmsInboundLookup,
} from "./client.js";
import { getTelcoredAuthorizationHeader } from "./secrets.js";
import { renderTemplateBody } from "./render.js";

jest.mock("./secrets.js", () => ({
  getTelcoredAuthorizationHeader: jest.fn(),
}));

const mockedAuth = getTelcoredAuthorizationHeader as jest.MockedFunction<
  typeof getTelcoredAuthorizationHeader
>;

describe("sms client", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedAuth.mockResolvedValue("Basic dGVzdDpzZWNyZXQ=");
  });

  it("validates Telcored sender labels", () => {
    expect(isValidTelcoredSender("msg")).toBe(true);
    expect(isValidTelcoredSender("573001234567")).toBe(true);
    expect(isValidTelcoredSender("invalid sender")).toBe(false);
    expect(normalizeTelcoredSender(" msg ")).toBe("msg");
  });

  it("registers inbound lookup only for phone-like values", () => {
    expect(shouldRegisterSmsInboundLookup("573001234567")).toBe(true);
    expect(shouldRegisterSmsInboundLookup("msg")).toBe(false);
  });

  it("renders template variables", () => {
    expect(renderTemplateBody("Hola {{1}}, pedido {{2}}", ["Ana", "42"])).toBe("Hola Ana, pedido 42");
  });

  it("sends SMS with Telcored payload and authorization header", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messageId: "telcored-123" }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await sendSmsTextMessage({
      phoneNumber: "+57 301 335 0265",
      text: "Holis, Prueba",
      from: "msg",
      environment: "dev",
    });

    expect(mockedAuth).toHaveBeenCalledWith("dev");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://omnicanal.telcoredsas.com/Api/rest/message",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Basic dGVzdDpzZWNyZXQ=",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          to: ["573013350265"],
          text: "Holis, Prueba",
          from: "msg",
        }),
      })
    );
    expect(result.messageId).toBe("telcored-123");
  });

  it("surfaces Telcored API errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }) as typeof fetch;

    await expect(
      sendSmsTextMessage({
        phoneNumber: "573001234567",
        text: "Test",
        from: "msg",
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Telcored API error 401: Unauthorized",
    });
  });
});
