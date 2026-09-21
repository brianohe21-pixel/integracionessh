import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../otp/service.js", () => ({
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

import { sendOtp, verifyOtp } from "../../otp/service.js";
import { executeSendOtpNode } from "./send-otp.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedSendOtp = jest.mocked(sendOtp);
const mockedVerifyOtp = jest.mocked(verifyOtp);

const flow: FlowDefinition = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "OTP flow",
  enabled: true,
  version: 1,
  nodes: [],
  edges: [
    { id: "e1", source: "otp-1", target: "verified-1", sourceHandle: "verified" },
    { id: "e2", source: "otp-1", target: "failed-1", sourceHandle: "failed" },
  ],
  entryNodeId: "trigger-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const node: FlowNode = {
  id: "otp-1",
  type: "send_otp",
  position: { x: 0, y: 0 },
  data: {
    label: "OTP",
    otpMessageText: "Code {{code}}",
    otpMaxAttempts: 3,
  },
};

const run: FlowRun = {
  runId: "run-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  flowId: "flow-1",
  conversationId: "conv-1",
  status: "waiting",
  currentNodeId: "otp-1",
  variables: {},
  stepHistory: [],
  stepCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildContext(overrides: Partial<FlowExecutionContext> = {}): FlowExecutionContext {
  return {
    mode: "conversation",
    tenantId: "tenant-1",
    botId: "bot-1",
    bot: {
      botId: "bot-1",
      tenantId: "tenant-1",
      name: "Bot",
      status: "active",
      responseMode: "none",
      phoneNumberId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      smsEnabled: true,
      smsOriginationNumber: "msg",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Bot,
    conversation: {
      conversationId: "conv-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      channel: "sms",
      participantId: "573001234567",
      phoneNumber: "573001234567",
      status: "active",
      messageCount: 1,
      lastMessageAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    } as Conversation,
    phoneNumberId: "phone-1",
    accessToken: "token",
    customerPhone: "573001234567",
    inbound: { text: "", messageType: "text", raw: { from: "573001234567", id: "1", timestamp: "1", type: "text" } },
    flow,
    channel: "sms",
    environment: "dev",
    ...overrides,
  };
}

describe("executeSendOtpNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSendOtp.mockResolvedValue({
      destination: "573001234567",
      channel: "sms",
      messageId: "msg-1",
      expiresAt: "2026-06-17T12:05:00.000Z",
      maxAttempts: 3,
    });
  });

  it("sends OTP and waits for reply on first execution", async () => {
    const result = await executeSendOtpNode(node, buildContext(), run);

    expect(mockedSendOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        botId: "bot-1",
        channel: "sms",
        to: "573001234567",
      })
    );
    expect(result.wait).toBe(true);
    expect(result.externalWait).toBe(true);
    expect(result.variables?.otp_sent).toBe("true");
  });

  it("routes to verified branch when code matches", async () => {
    mockedVerifyOtp.mockResolvedValue({ verified: true, reason: "verified" });

    const result = await executeSendOtpNode(
      node,
      buildContext({
        inbound: {
          text: "123456",
          messageType: "text",
          raw: { from: "573001234567", id: "2", timestamp: "2", type: "text" },
        },
      }),
      { ...run, variables: { otp_sent: "true", otp_destination: "573001234567" } }
    );

    expect(result.nextNodeId).toBe("verified-1");
    expect(result.output).toBe("verified");
  });

  it("routes to failed branch when verification is exhausted", async () => {
    mockedVerifyOtp.mockResolvedValue({ verified: false, reason: "max_attempts", attemptsRemaining: 0 });

    const result = await executeSendOtpNode(
      node,
      buildContext({
        inbound: {
          text: "000000",
          messageType: "text",
          raw: { from: "573001234567", id: "2", timestamp: "2", type: "text" },
        },
      }),
      { ...run, variables: { otp_sent: "true", otp_destination: "573001234567" } }
    );

    expect(result.nextNodeId).toBe("failed-1");
    expect(result.output).toBe("max_attempts");
  });
});
