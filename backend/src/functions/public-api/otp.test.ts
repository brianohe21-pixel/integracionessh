import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

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

jest.mock("../../lib/otp/service.js", () => ({
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  assertOtpChannelReady: jest.fn(),
}));

import { getApiKeyByHash } from "../../lib/dynamodb/api-key.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { sendOtp, verifyOtp } from "../../lib/otp/service.js";
import { handler } from "./index.js";

const mockedGetApiKeyByHash = jest.mocked(getApiKeyByHash);
const mockedGetBot = jest.mocked(getBot);
const mockedSendOtp = jest.mocked(sendOtp);
const mockedVerifyOtp = jest.mocked(verifyOtp);

const apiKey = {
  keyId: "key-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Test",
  prefix: "isk_test",
  hashedKey: "hashed-key",
  scopes: ["otp:send", "otp:verify"],
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

describe("public-api otp routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetApiKeyByHash.mockResolvedValue(apiKey);
    mockedGetBot.mockResolvedValue(bot as never);
  });

  it("sends OTP when scope is present", async () => {
    mockedSendOtp.mockResolvedValue({
      destination: "573001234567",
      channel: "sms",
      messageId: "msg-1",
      expiresAt: "2026-06-17T12:05:00.000Z",
      maxAttempts: 3,
      receiptId: "trace-1",
    });

    const response = asObjectResponse(
      await handler(
        makeEvent(
          "POST",
          "/v1/otp/send",
          JSON.stringify({ channel: "sms", to: "573001234567" })
        )
      )
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toMatchObject({
      destination: "573001234567",
      channel: "sms",
      messageId: "msg-1",
      maxAttempts: 3,
      traceId: "trace-1",
    });
  });

  it("verifies OTP when scope is present", async () => {
    mockedVerifyOtp.mockResolvedValue({ verified: true, reason: "verified" });

    const response = asObjectResponse(
      await handler(
        makeEvent(
          "POST",
          "/v1/otp/verify",
          JSON.stringify({ to: "573001234567", code: "123456" })
        )
      )
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      verified: true,
      reason: "verified",
      timestamp: expect.any(String),
    });
  });

  it("returns 403 when otp send scope is missing", async () => {
    mockedGetApiKeyByHash.mockResolvedValue({
      ...apiKey,
      scopes: ["otp:verify"],
    });

    const response = asObjectResponse(
      await handler(
        makeEvent(
          "POST",
          "/v1/otp/send",
          JSON.stringify({ channel: "sms", to: "573001234567" })
        )
      )
    );

    expect(response.statusCode).toBe(403);
  });
});
