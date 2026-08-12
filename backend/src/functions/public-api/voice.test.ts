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

jest.mock("../../lib/dynamodb/call.repository.js", () => ({
  getCallRecord: jest.fn(),
  listCallsByBotPaginated: jest.fn(),
}));

jest.mock("../../lib/dynamodb/call-event.repository.js", () => ({
  listCallEvents: jest.fn(),
}));

jest.mock("../../lib/dynamodb/conversation.repository.js", () => ({
  getConversationMessages: jest.fn(),
}));

jest.mock("../../lib/dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
  updateBot: jest.fn(),
}));

jest.mock("../../lib/telephony/service.js", () => ({
  startOutboundTelephonyCall: jest.fn(),
  terminateTelephonyCall: jest.fn(),
}));

jest.mock("../../lib/s3/client.js", () => ({
  getPresignedReadUrl: jest.fn(),
}));

import { getApiKeyByHash } from "../../lib/dynamodb/api-key.repository.js";
import { getCallRecord, listCallsByBotPaginated } from "../../lib/dynamodb/call.repository.js";
import { listCallEvents } from "../../lib/dynamodb/call-event.repository.js";
import { getConversationMessages } from "../../lib/dynamodb/conversation.repository.js";
import { getBot, updateBot } from "../../lib/dynamodb/bot.repository.js";
import { startOutboundTelephonyCall, terminateTelephonyCall } from "../../lib/telephony/service.js";
import { getPresignedReadUrl } from "../../lib/s3/client.js";
import { API_KEY_SCOPES } from "../../lib/api-keys/scopes.js";
import { handler } from "./index.js";

const mockedGetApiKeyByHash = jest.mocked(getApiKeyByHash);
const mockedGetCallRecord = jest.mocked(getCallRecord);
const mockedListCallsByBotPaginated = jest.mocked(listCallsByBotPaginated);
const mockedListCallEvents = jest.mocked(listCallEvents);
const mockedGetConversationMessages = jest.mocked(getConversationMessages);
const mockedGetBot = jest.mocked(getBot);
const mockedUpdateBot = jest.mocked(updateBot);
const mockedStartOutbound = jest.mocked(startOutboundTelephonyCall);
const mockedTerminate = jest.mocked(terminateTelephonyCall);
const mockedGetPresignedReadUrl = jest.mocked(getPresignedReadUrl);

const baseApiKey = {
  keyId: "key-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Test",
  prefix: "isk_test",
  hashedKey: "hashed-key",
  scopes: [
    API_KEY_SCOPES.voiceCallsInitiate,
    API_KEY_SCOPES.voiceCallsRead,
    API_KEY_SCOPES.voiceCallsManage,
  ],
  rateLimitPerMinute: 60,
  rateLimitPerDay: 1000,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const telnyxCall = {
  callId: "call-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  phoneNumber: "573001234567",
  businessPhoneNumber: "+12025550100",
  direction: "BUSINESS_INITIATED" as const,
  status: "accepted" as const,
  provider: "telnyx" as const,
  channel: "phone" as const,
  conversationId: "conv-1",
  recordingStatus: "ready" as const,
  recordingS3Key: "recordings/call-1.mp3",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:01:00.000Z",
};

const baseBot = {
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Voice Agent",
  phoneNumberId: "pn-1",
  whatsappBusinessAccountId: "waba-1",
  status: "active" as const,
  responseMode: "none" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeEvent(
  method: string,
  path: string,
  body?: string,
  query?: Record<string, string>
): APIGatewayProxyEventV2 {
  return {
    rawPath: path,
    body,
    headers: { "x-api-key": "isk_test_secret" },
    queryStringParameters: query,
    requestContext: {
      http: { method, path },
    },
  } as unknown as APIGatewayProxyEventV2;
}

function asObjectResponse(response: Awaited<ReturnType<typeof handler>>) {
  return response as { statusCode: number; body?: string };
}

describe("public-api voice routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetApiKeyByHash.mockResolvedValue(baseApiKey);
  });

  it("starts outbound voice call", async () => {
    mockedStartOutbound.mockResolvedValue({
      callId: "call-1",
      sessionId: "session-1",
      status: "initiated",
    });

    const response = asObjectResponse(
      await handler(
        makeEvent(
          "POST",
          "/v1/voice/calls",
          JSON.stringify({ to: "573001234567", contactName: "Jane" })
        )
      )
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? "{}")).toMatchObject({
      callId: "call-1",
      sessionId: "session-1",
      status: "initiated",
    });
  });

  it("returns 403 without voice initiate scope", async () => {
    mockedGetApiKeyByHash.mockResolvedValue({
      ...baseApiKey,
      scopes: [API_KEY_SCOPES.voiceCallsRead],
    });

    const response = asObjectResponse(
      await handler(
        makeEvent("POST", "/v1/voice/calls", JSON.stringify({ to: "573001234567" }))
      )
    );

    expect(response.statusCode).toBe(403);
  });

  it("lists telnyx voice calls without internal fields", async () => {
    mockedListCallsByBotPaginated.mockResolvedValue({
      items: [
        {
          ...telnyxCall,
          callControlId: "ctrl-1",
          conversationId: "conv-1",
          recordingS3Key: "secret-key",
          telnyxRecordingId: "rec-1",
        },
      ],
    });

    const response = asObjectResponse(await handler(makeEvent("GET", "/v1/voice/calls")));
    const body = JSON.parse(response.body ?? "{}");

    expect(response.statusCode).toBe(200);
    expect(body.items[0]).toMatchObject({
      callId: "call-1",
      direction: "outbound",
      phoneNumber: "573001234567",
    });
    expect(body.items[0]).not.toHaveProperty("callControlId");
    expect(body.items[0]).not.toHaveProperty("conversationId");
    expect(body.items[0]).not.toHaveProperty("recordingS3Key");
  });

  it("returns 404 for whatsapp call on voice detail", async () => {
    mockedGetCallRecord.mockResolvedValue({
      ...telnyxCall,
      provider: "meta",
      callId: "wa-call",
    });

    const response = asObjectResponse(
      await handler(makeEvent("GET", "/v1/voice/calls/wa-call"))
    );

    expect(response.statusCode).toBe(404);
  });

  it("returns call events and recording url", async () => {
    mockedGetCallRecord.mockResolvedValue(telnyxCall);
    mockedListCallEvents.mockResolvedValue([
      {
        eventId: "evt-1",
        tenantId: "tenant-1",
        botId: "bot-1",
        callId: "call-1",
        type: "initiated",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mockedGetPresignedReadUrl.mockResolvedValue("https://signed.example/recording");

    const eventsResponse = asObjectResponse(
      await handler(makeEvent("GET", "/v1/voice/calls/call-1/events"))
    );
    expect(eventsResponse.statusCode).toBe(200);

    const recordingResponse = asObjectResponse(
      await handler(makeEvent("GET", "/v1/voice/calls/call-1/recording"))
    );
    expect(recordingResponse.statusCode).toBe(200);
    expect(JSON.parse(recordingResponse.body ?? "{}")).toEqual({
      url: "https://signed.example/recording",
      expiresInSeconds: 900,
    });
  });

  it("ends call with manage scope", async () => {
    mockedGetCallRecord.mockResolvedValue(telnyxCall);
    mockedTerminate.mockResolvedValue();

    const response = asObjectResponse(
      await handler(makeEvent("POST", "/v1/voice/calls/call-1/end"))
    );

    expect(response.statusCode).toBe(200);
    expect(mockedTerminate).toHaveBeenCalledWith("tenant-1", "call-1");
  });

  it("returns transcript messages", async () => {
    mockedGetCallRecord.mockResolvedValue(telnyxCall);
    mockedGetConversationMessages.mockResolvedValue([
      {
        messageId: "msg-1",
        conversationId: "conv-1",
        tenantId: "tenant-1",
        role: "assistant",
        content: "Hello",
        timestamp: "2026-01-01T00:00:05.000Z",
      },
    ]);

    const response = asObjectResponse(
      await handler(makeEvent("GET", "/v1/voice/calls/call-1/transcript"))
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      items: [
        {
          messageId: "msg-1",
          role: "assistant",
          content: "Hello",
          timestamp: "2026-01-01T00:00:05.000Z",
        },
      ],
    });
  });

  it("gets voice structured output config", async () => {
    mockedGetBot.mockResolvedValue({
      ...baseBot,
      telephonyStructuredOutput: {
        name: "customer_order",
        type: "ai",
        schema: {
          type: "object",
          properties: {
            subtotal: { type: "number", description: "subtotal" },
          },
          additionalProperties: false,
        },
      },
    });

    const response = asObjectResponse(
      await handler(makeEvent("GET", "/v1/voice/agents/bot-1/structured-output"))
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      botId: "bot-1",
      structuredOutput: {
        name: "customer_order",
        type: "ai",
        schema: {
          type: "object",
          properties: {
            subtotal: { type: "number", description: "subtotal" },
          },
          additionalProperties: false,
        },
      },
    });
  });

  it("updates voice structured output config", async () => {
    mockedGetBot.mockResolvedValue(baseBot);
    mockedUpdateBot.mockResolvedValue({
      ...baseBot,
      telephonyStructuredOutput: {
        name: "customer_order",
        type: "ai",
        schema: {
          type: "object",
          properties: {
            nombre_cliente: { type: "string", description: "nombre cliente" },
          },
          additionalProperties: false,
        },
      },
    });

    const response = asObjectResponse(
      await handler(
        makeEvent(
          "PUT",
          "/v1/voice/agents/bot-1/structured-output",
          JSON.stringify({
            name: "customer_order",
            type: "ai",
            result: {
              nombre_cliente: "Daniel Salcedo",
            },
          })
        )
      )
    );

    expect(response.statusCode).toBe(200);
    expect(mockedUpdateBot).toHaveBeenCalled();
    expect(JSON.parse(response.body ?? "{}").structuredOutput?.name).toBe("customer_order");
  });

  it("returns 403 for structured output on another bot", async () => {
    const response = asObjectResponse(
      await handler(makeEvent("GET", "/v1/voice/agents/other-bot/structured-output"))
    );

    expect(response.statusCode).toBe(403);
  });
});
