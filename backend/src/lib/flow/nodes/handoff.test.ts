import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../advisor/handoff.js", () => ({
  performHandoff: jest.fn(),
}));

import { performHandoff } from "../../advisor/handoff.js";
import { executeHandoffNode } from "./handoff.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedPerformHandoff = jest.mocked(performHandoff);

const bot = {
  botId: "bot-1",
  tenantId: "tenant-1",
  name: "Bot",
  responseMode: "openai",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as Bot;

const conversation = {
  conversationId: "conv-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  channel: "whatsapp",
  participantId: "573001112233",
  phoneNumber: "573001112233",
  status: "active",
  messageCount: 1,
  lastMessageAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
} as Conversation;

const flow: FlowDefinition = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Test",
  enabled: true,
  version: 1,
  entryNodeId: "handoff-1",
  nodes: [],
  edges: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function makeCtx(): FlowExecutionContext {
  return {
    mode: "conversation",
    tenantId: "tenant-1",
    botId: "bot-1",
    bot,
    conversation,
    flow,
    phoneNumberId: "phone-1",
    accessToken: "token",
    customerPhone: "573001112233",
    channel: "whatsapp",
    environment: "dev",
  };
}

function makeRun(): FlowRun {
  return {
    runId: "run-1",
    flowId: "flow-1",
    tenantId: "tenant-1",
    botId: "bot-1",
    source: "conversation",
    conversationId: "conv-1",
    customerPhone: "573001112233",
    status: "active",
    currentNodeId: "handoff-1",
    variables: {},
    stepHistory: [],
    stepCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("executeHandoffNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPerformHandoff.mockResolvedValue(conversation);
  });

  it("auto-assigns an advisor when none is configured", async () => {
    const node: FlowNode = {
      id: "handoff-1",
      type: "handoff",
      position: { x: 0, y: 0 },
      data: { label: "Handoff" },
    };

    const result = await executeHandoffNode(node, makeCtx(), makeRun());

    expect(mockedPerformHandoff).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      botId: "bot-1",
      conversationId: "conv-1",
      reason: "ai",
    });
    expect(result).toEqual({
      nextNodeId: null,
      halt: true,
      wait: false,
      output: "handoff",
    });
  });

  it("passes the configured advisorId when set", async () => {
    const node: FlowNode = {
      id: "handoff-1",
      type: "handoff",
      position: { x: 0, y: 0 },
      data: { label: "Handoff", advisorId: "  adv-9  " },
    };

    await executeHandoffNode(node, makeCtx(), makeRun());

    expect(mockedPerformHandoff).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      botId: "bot-1",
      conversationId: "conv-1",
      reason: "ai",
      advisorId: "adv-9",
    });
  });
});
