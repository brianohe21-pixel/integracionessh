import { handler } from "../../functions/sms-webhook/index.js";
import { applySmsDlrCallback } from "../../lib/dynamodb/sms-dlr.repository.js";

jest.mock("../../lib/dynamodb/sms-dlr.repository.js", () => ({
  applySmsDlrCallback: jest.fn(),
}));

const mockedApply = applySmsDlrCallback as jest.MockedFunction<typeof applySmsDlrCallback>;

function makeDlrEvent(query: Record<string, string>) {
  return {
    version: "2.0",
    routeKey: "GET /sms/dlr",
    rawPath: "/sms/dlr",
    rawQueryString: new URLSearchParams(query).toString(),
    headers: {},
    requestContext: {
      http: {
        method: "GET",
        path: "/sms/dlr",
      },
    },
    queryStringParameters: query,
    isBase64Encoded: false,
  };
}

describe("sms-webhook dlr handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns 400 when receiptId is missing", async () => {
    const result = await handler(makeDlrEvent({ deliveryCode: "1" }) as never);
    expect(result).toEqual({ statusCode: 400, body: "Missing receiptId" });
  });

  it("returns 404 when receipt is not found", async () => {
    mockedApply.mockResolvedValue("not_found");
    const result = await handler(
      makeDlrEvent({ receiptId: "missing", deliveryCode: "1" }) as never
    );
    expect(result).toEqual({ statusCode: 404, body: "Receipt not found" });
  });

  it("returns 200 when callback is applied", async () => {
    mockedApply.mockResolvedValue("updated");
    const result = await handler(
      makeDlrEvent({
        receiptId: "receipt-1",
        deliveryCode: "1",
        messageId: "msg-1",
      }) as never
    );
    expect(mockedApply).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId: "receipt-1",
        deliveryCode: 1,
        messageId: "msg-1",
      })
    );
    expect(result).toEqual({ statusCode: 200, body: "OK" });
  });
});
