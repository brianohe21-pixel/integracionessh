import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../dynamodb/flow.repository.js", () => ({
  createFlowRun: jest.fn(async (run: unknown) => run),
  getActiveFlowRunForConversation: jest.fn(),
  getFlowDefinition: jest.fn(),
  getFlowRun: jest.fn(),
  updateFlowRun: jest.fn(async (_tenantId: string, _runId: string, patch: unknown) => patch),
}));

jest.mock("../dynamodb/conversation.repository.js", () => ({
  clearActiveFlowRun: jest.fn(async () => undefined),
  setActiveFlowRun: jest.fn(async () => undefined),
}));

jest.mock("./nodes/index.js", () => ({
  executeNode: jest.fn(),
}));

jest.mock("./schedule.js", () => ({
  scheduleFlowResume: jest.fn(),
}));

import { clearActiveFlowRun } from "../dynamodb/conversation.repository.js";
import { executeNode } from "./nodes/index.js";
import { resolveFlowPipelineHalt, startFlowRun } from "./interpreter.js";
import type { Bot, Conversation, FlowDefinition, FlowNode } from "../../types/index.js";

const mockedExecuteNode = jest.mocked(executeNode);
const mockedClearActiveFlowRun = jest.mocked(clearActiveFlowRun);

const bot = {
  botId: "bot-1",
  tenantId: "tenant-1",
  name: "Bot",
  responseMode: "openai",
  phoneNumberId: "phone-1",
  whatsappBusinessAccountId: "waba-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as Bot;

const conversation = {
  conversationId: "conv-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  channel: "whatsapp",
  participantId: "CO.123",
  phoneNumber: "573001112233",
  status: "active",
  messageCount: 1,
  lastMessageAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
} as Conversation;

function makeFlow(nodes: FlowNode[]): FlowDefinition {
  return {
    flowId: "flow-1",
    tenantId: "tenant-1",
    botId: "bot-1",
    name: "Test",
    enabled: true,
    version: 1,
    entryNodeId: nodes[0]?.id ?? "n1",
    nodes,
    edges: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("resolveFlowPipelineHalt", () => {
  it("halts when the node asks to halt", () => {
    expect(
      resolveFlowPipelineHalt(
        { id: "m1", type: "message", position: { x: 0, y: 0 }, data: {} },
        { halt: true, nextNodeId: "next" }
      )
    ).toBe(true);
  });

  it("continues when there is a next node and halt is false", () => {
    expect(
      resolveFlowPipelineHalt(
        { id: "m1", type: "message", position: { x: 0, y: 0 }, data: {} },
        { halt: false, nextNodeId: "next" }
      )
    ).toBe(false);
  });

  it("halts when a regular node completes without next", () => {
    expect(
      resolveFlowPipelineHalt(
        { id: "m1", type: "message", position: { x: 0, y: 0 }, data: {} },
        { halt: false, nextNodeId: null }
      )
    ).toBe(true);
  });

  it("allows assign_bot to continue into the AI assistant", () => {
    expect(
      resolveFlowPipelineHalt(
        { id: "a1", type: "assign_bot", position: { x: 0, y: 0 }, data: {} },
        { halt: false, nextNodeId: null }
      )
    ).toBe(false);
  });

  it("allows end/handoff with haltPipeline false to continue", () => {
    expect(
      resolveFlowPipelineHalt(
        { id: "e1", type: "end", position: { x: 0, y: 0 }, data: { haltPipeline: false } },
        { halt: false, nextNodeId: null }
      )
    ).toBe(false);
  });
});

describe("startFlowRun coexistence with AI assistant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("halts the inbound pipeline when a message flow completes", async () => {
    mockedExecuteNode.mockResolvedValueOnce({
      nextNodeId: null,
      halt: false,
      wait: false,
      output: "Hola",
    } as never);

    const result = await startFlowRun({
      flow: makeFlow([
        {
          id: "message-1",
          type: "message",
          position: { x: 0, y: 0 },
          data: { messageText: { es: "Hola", en: "Hi" } },
        },
      ]),
      tenantId: "tenant-1",
      botId: "bot-1",
      bot,
      conversation,
      phoneNumberId: "phone-1",
      accessToken: "token",
      customerPhone: "CO.123",
      inbound: { text: "Hola", messageType: "text", raw: {} },
      channel: "whatsapp",
    });

    expect(result).toEqual({ handled: true, halt: true });
    expect(mockedClearActiveFlowRun).toHaveBeenCalledWith("tenant-1", "bot-1", "conv-1");
  });

  it("continues the inbound pipeline when assign_bot hands off to AI", async () => {
    mockedExecuteNode.mockResolvedValueOnce({
      nextNodeId: null,
      halt: false,
      wait: false,
      output: "ai_assistant",
      variables: { handed_off_to_ai: "true" },
    } as never);

    const result = await startFlowRun({
      flow: makeFlow([
        {
          id: "assign-1",
          type: "assign_bot",
          position: { x: 0, y: 0 },
          data: {},
        },
      ]),
      tenantId: "tenant-1",
      botId: "bot-1",
      bot,
      conversation,
      phoneNumberId: "phone-1",
      accessToken: "token",
      customerPhone: "CO.123",
      inbound: { text: "Hola", messageType: "text", raw: {} },
      channel: "whatsapp",
    });

    expect(result).toEqual({ handled: true, halt: false });
  });
});
