import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../channels/router.js", () => ({
  buildOutboundContext: jest.fn((ctx: unknown) => ctx),
}));

jest.mock("../send-text.js", () => ({
  sendFlowChannelText: jest.fn(async () => undefined),
}));

jest.mock("../../i18n/index.js", () => ({
  getBotLocale: jest.fn(() => "es"),
  resolveLocalizedText: jest.fn((v: { es?: string; en?: string } | string | undefined) =>
    typeof v === "string" ? v : (v?.es ?? "")
  ),
}));

import { sendFlowChannelText } from "../send-text.js";
import { executeMessageNode } from "./message.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedSendFlowChannelText = jest.mocked(sendFlowChannelText);

const bot = {
  botId: "bot-1",
  tenantId: "t1",
  name: "Bot",
  status: "active",
  responseMode: "none",
  phoneNumberId: "pn",
  whatsappBusinessAccountId: "waba-1",
  createdAt: "",
  updatedAt: "",
} as Bot;

const conversation = {
  conversationId: "c1",
  tenantId: "t1",
  botId: "bot-1",
  phoneNumber: "573001111111",
  participantId: "573001111111",
  channel: "whatsapp",
  status: "active",
  messageCount: 1,
  lastMessageAt: "",
  createdAt: "",
} as Conversation;

const flow: FlowDefinition = {
  flowId: "f1",
  tenantId: "t1",
  botId: "bot-1",
  name: "test",
  enabled: true,
  version: 1,
  entryNodeId: "m1",
  nodes: [],
  edges: [{ id: "e1", source: "m1", target: "m2" }],
  createdAt: "",
  updatedAt: "",
};

const run: FlowRun = {
  runId: "r1",
  flowId: "f1",
  tenantId: "t1",
  botId: "bot-1",
  conversationId: "c1",
  status: "active",
  currentNodeId: "m1",
  variables: {},
  stepHistory: [],
  stepCount: 0,
  createdAt: "",
  updatedAt: "",
};

function ctx(): FlowExecutionContext {
  return {
    mode: "conversation",
    tenantId: "t1",
    botId: "bot-1",
    bot,
    conversation,
    phoneNumberId: "pn",
    accessToken: "tok",
    customerPhone: "573001111111",
    inbound: {
      text: "hola",
      messageType: "text",
      raw: { from: "573001111111", id: "1", timestamp: "1", type: "text" },
    },
    flow,
    channel: "whatsapp",
    environment: "dev",
  };
}

function node(waitForReply?: boolean): FlowNode {
  return {
    id: "m1",
    type: "message",
    position: { x: 0, y: 0 },
    data: {
      messageText: { es: "Cual es tu nombre?", en: "What is your name?" },
      ...(waitForReply ? { waitForReply: true } : {}),
    },
  };
}

describe("executeMessageNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("continues immediately when waitForReply is off", async () => {
    const result = await executeMessageNode(node(false), ctx(), run);
    expect(mockedSendFlowChannelText).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      nextNodeId: "m2",
      halt: false,
      wait: false,
    });
  });

  it("waits for reply when waitForReply is on", async () => {
    const result = await executeMessageNode(node(true), ctx(), run);
    expect(mockedSendFlowChannelText).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      nextNodeId: null,
      halt: true,
      wait: true,
    });
  });
});
