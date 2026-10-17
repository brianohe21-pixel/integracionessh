import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

vi.mock("../../channels/router.js", () => ({
  buildOutboundContext: vi.fn((v) => v),
}));

vi.mock("../send-text.js", () => ({
  sendFlowChannelText: vi.fn(async () => undefined),
}));

vi.mock("../../i18n/index.js", () => ({
  getBotLocale: vi.fn(() => "es"),
  resolveLocalizedText: vi.fn((v: { es?: string } | string | undefined) =>
    typeof v === "string" ? v : (v?.es ?? "")
  ),
}));

import { sendFlowChannelText } from "../send-text.js";
import { executeMessageNode } from "./message.js";

const bot = { botId: "bot-1", locale: "es" } as Bot;
const conversation = {
  conversationId: "c1",
  phoneNumber: "573001111111",
  channel: "whatsapp",
} as Conversation;

const flow: FlowDefinition = {
  flowId: "f1",
  tenantId: "t1",
  name: "test",
  status: "published",
  version: 1,
  entryNodeId: "m1",
  nodes: [],
  edges: [{ id: "e1", source: "m1", target: "m2" }],
  createdAt: "",
  updatedAt: "",
} as FlowDefinition;

const run = {
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
} as FlowRun;

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
    inbound: { text: "hola", messageType: "text", raw: {} },
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
      messageText: { es: "Cual es tu nombre?" },
      ...(waitForReply ? { waitForReply: true } : {}),
    },
  };
}

describe("executeMessageNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues immediately when waitForReply is off", async () => {
    const result = await executeMessageNode(node(false), ctx(), run);
    expect(sendFlowChannelText).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      nextNodeId: "m2",
      halt: false,
      wait: false,
    });
  });

  it("waits for reply when waitForReply is on", async () => {
    const result = await executeMessageNode(node(true), ctx(), run);
    expect(sendFlowChannelText).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      nextNodeId: null,
      halt: true,
      wait: true,
    });
  });
});
