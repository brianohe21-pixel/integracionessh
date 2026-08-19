import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

jest.mock("../../lib/api-keys/manager.js", () => ({
  hashApiKey: jest.fn(() => "hashed-key"),
}));

jest.mock("../../lib/rate-limiter/index.js", () => ({
  checkAndIncrement: jest.fn(async () => ({
    allowed: true,
    minuteRemaining: 10,
    dayRemaining: 100,
  })),
}));

jest.mock("../../lib/dynamodb/api-key.repository.js", () => ({
  getApiKeyByHash: jest.fn(),
  updateApiKey: jest.fn(),
}));

jest.mock("../../lib/dynamodb/api-key-usage.repository.js", () => ({
  logApiKeyUsage: jest.fn(),
}));

jest.mock("../../lib/dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
}));

jest.mock("../../lib/dynamodb/usage.repository.js", () => ({
  incrementMessages: jest.fn(),
}));

jest.mock("../../lib/sms/send-outbound.js", () => ({
  sendSmsTextWithDlr: jest.fn(),
}));

jest.mock("../../lib/dynamodb/sms-dlr.repository.js", () => ({
  getSmsDlrReceipt: jest.fn(),
}));

import { getApiKeyByHash } from "../../lib/dynamodb/api-key.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getSmsDlrReceipt } from "../../lib/dynamodb/sms-dlr.repository.js";
import { sendSmsTextWithDlr } from "../../lib/sms/send-outbound.js";
import { handler } from "./index.js";

const mockedGetApiKeyByHash = jest.mocked(getApiKeyByHash);
const mockedGetBot = jest.mocked(getBot);
const mockedSendSmsTextWithDlr = jest.mocked(sendSmsTextWithDlr);
const mockedGetSmsDlrReceipt = jest.mocked(getSmsDlrReceipt);

const apiKey = {
  keyId: "key-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Test",
  prefix: "isk_test",
  hashedKey: "hashed-key",
  scopes: ["sms:send", "sms:read"],
  rateLimitPerMinute: 60,
  rateLimitPerDay: 1000,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const bot = {
  botId: "bot-1",
  tenantId: "tenant-1",
  name: "Bot",
  status: "active",
  smsEnabled: true,
  smsOriginationNumber: "msg",
  phoneNumberId: "phone-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeEvent(
  method: string,
  path: string,
  body?: string
): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    body,
    headers: { "x-api-key": "isk_test_secret" },
    requestContext: {
      http: { method, path },
    },
  } as unknown as APIGatewayProxyEventV2;
}

function asObjectResponse(response: Awaited<ReturnType<typeof handler>>) {
  return response as { statusCode: number; body?: string };
}

describe("public-api sms routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetApiKeyByHash.mockResolvedValue(apiKey);
    mockedGetBot.mockResolvedValue(bot as never);
  });

  it("sends SMS and returns traceId", async () => {
    mockedSendSmsTextWithDlr.mockResolvedValue({
      messageId: "telcored-123",
      text: "Hello",
      receiptId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const response = asObjectResponse(
      await handler(
        makeEvent("POST", "/v1/sms", JSON.stringify({ to: "573001234567", text: "Hello" }))
      )
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      traceId: "550e8400-e29b-41d4-a716-446655440000",
      messageId: "telcored-123",
      status: "sent",
      timestamp: expect.any(String),
    });
  });

  it("returns traceId when provider send fails", async () => {
    mockedSendSmsTextWithDlr.mockRejectedValue(
      Object.assign(new Error("Telcored API error 502"), {
        receiptId: "550e8400-e29b-41d4-a716-446655440001",
        statusCode: 502,
      })
    );

    const response = asObjectResponse(
      await handler(
        makeEvent("POST", "/v1/sms", JSON.stringify({ to: "573001234567", text: "Hello" }))
      )
    );

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      traceId: "550e8400-e29b-41d4-a716-446655440001",
      status: "send_failed",
      error: "Telcored API error 502",
      timestamp: expect.any(String),
    });
  });

  it("returns traceability for owned receipt", async () => {
    mockedGetSmsDlrReceipt.mockResolvedValue({
      receiptId: "550e8400-e29b-41d4-a716-446655440000",
      tenantId: "tenant-1",
      botId: "bot-1",
      source: "api",
      to: "573001234567",
      telcoredMessageId: "telcored-123",
      finalDeliveryCode: 1,
      deliveryStatus: "DELIVRD",
      dlrAt: "2026-06-17T12:00:05.000Z",
      metricsApplied: false,
      createdAt: "2026-06-17T12:00:00.000Z",
      updatedAt: "2026-06-17T12:00:05.000Z",
    });

    const response = asObjectResponse(
      await handler(
        makeEvent("GET", "/v1/sms/550e8400-e29b-41d4-a716-446655440000")
      )
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toMatchObject({
      traceId: "550e8400-e29b-41d4-a716-446655440000",
      status: "delivered",
      phone: "573001234567",
    });
  });

  it("returns 404 for receipt from another tenant", async () => {
    mockedGetSmsDlrReceipt.mockResolvedValue({
      receiptId: "550e8400-e29b-41d4-a716-446655440000",
      tenantId: "tenant-2",
      botId: "bot-1",
      source: "api",
      to: "573001234567",
      metricsApplied: false,
      createdAt: "2026-06-17T12:00:00.000Z",
      updatedAt: "2026-06-17T12:00:05.000Z",
    });

    const response = asObjectResponse(
      await handler(
        makeEvent("GET", "/v1/sms/550e8400-e29b-41d4-a716-446655440000")
      )
    );

    expect(response.statusCode).toBe(404);
  });
});
