import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../dynamodb/flow.repository.js", () => ({
  createFlowRun: jest.fn(async (run: unknown) => run),
  getActiveFlowRunForConversation: jest.fn(),
  getFlowDefinition: jest.fn(),
  getFlowRun: jest.fn(),
  updateFlowRun: jest.fn(async () => ({})),
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
import { updateFlowRun } from "../dynamodb/flow.repository.js";
import { executeNode } from "./nodes/index.js";
import { startFlowRun } from "./interpreter.js";
import type { Bot, Conversation, FlowDefinition } from "../../types/index.js";

const mockedExecuteNode = jest.mocked(executeNode);
const mockedUpdateFlowRun = jest.mocked(updateFlowRun);
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

const flow: FlowDefinition = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Test",
  enabled: true,
  version: 1,
  entryNodeId: "message-1",
  nodes: [
    {
      id: "message-1",
      type: "message",
      position: { x: 0, y: 0 },
      data: { messageText: { es: "Hola", en: "Hi" } },
    },
  ],
  edges: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("startFlowRun node error isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks the run failed and does not throw when a node fails", async () => {
    mockedExecuteNode.mockRejectedValueOnce(new Error("Email could not be sent") as never);

    const result = await startFlowRun({
      flow,
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

    expect(result).toEqual({
      handled: true,
      halt: true,
      errorMessage: "Email could not be sent",
    });
    expect(mockedUpdateFlowRun).toHaveBeenCalledWith(
      "tenant-1",
      expect.any(String),
      expect.objectContaining({
        status: "failed",
        errorMessage: "Email could not be sent",
      })
    );
    expect(mockedClearActiveFlowRun).toHaveBeenCalledWith("tenant-1", "bot-1", "conv-1");
  });
});
