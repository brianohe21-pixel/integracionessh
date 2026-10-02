import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../ai-assistant/config.js", () => ({
  isAiAssistantEnabled: jest.fn(),
}));

jest.mock("../../dynamodb/bot.repository.js", () => ({
  getBot: jest.fn(),
}));

import { isAiAssistantEnabled } from "../../ai-assistant/config.js";
import { getBot } from "../../dynamodb/bot.repository.js";
import { executeAssignBotNode } from "./assign-bot.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedIsAiAssistantEnabled = jest.mocked(isAiAssistantEnabled);
const mockedGetBot = jest.mocked(getBot);

const contextBot = {
  botId: "bot-context",
  tenantId: "tenant-1",
  name: "Context",
  responseMode: "openai",
  phoneNumberId: "phone-1",
  whatsappBusinessAccountId: "waba-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as Bot;

const selectedBot = {
  ...contextBot,
  botId: "bot-selected",
  name: "Selected",
} as Bot;

const conversation = {
  conversationId: "conv-1",
  tenantId: "tenant-1",
  botId: "bot-context",
  channel: "whatsapp",
  participantId: "CO.123",
  phoneNumber: "573001112233",
  status: "active",
  messageCount: 1,
  lastMessageAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
} as Conversation;

const flow = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-context",
  name: "Test",
  enabled: true,
  version: 1,
  entryNodeId: "assign-1",
  nodes: [],
  edges: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as FlowDefinition;

const run = {
  runId: "run-1",
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-context",
  source: "conversation",
  conversationId: "conv-1",
  status: "active",
  currentNodeId: "assign-1",
  variables: {},
  stepHistory: [],
  stepCount: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
} as FlowRun;

const ctx: FlowExecutionContext = {
  mode: "conversation",
  tenantId: "tenant-1",
  botId: "bot-context",
  bot: contextBot,
  conversation,
  phoneNumberId: "phone-1",
  accessToken: "token",
  customerPhone: "CO.123",
  inbound: { text: "hola", messageType: "text", raw: {} },
  flow,
  channel: "whatsapp",
  environment: "dev",
};

describe("executeAssignBotNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the context bot when no botId is configured", async () => {
    mockedIsAiAssistantEnabled.mockReturnValue(true);
    const node = {
      id: "assign-1",
      type: "assign_bot",
      position: { x: 0, y: 0 },
      data: {},
    } as FlowNode;

    const result = await executeAssignBotNode(node, ctx, run);

    expect(mockedGetBot).not.toHaveBeenCalled();
    expect(result).toEqual({
      nextNodeId: null,
      halt: false,
      wait: false,
      variables: {
        handed_off_to_ai: "true",
        ai_bot_id: "bot-context",
      },
      output: "ai_assistant",
    });
  });

  it("loads the selected agent and continues with its AI assistant", async () => {
    mockedIsAiAssistantEnabled.mockReturnValue(true);
    mockedGetBot.mockResolvedValueOnce(selectedBot);
    const node = {
      id: "assign-1",
      type: "assign_bot",
      position: { x: 0, y: 0 },
      data: { botId: "bot-selected" },
    } as FlowNode;

    const result = await executeAssignBotNode(node, ctx, run);

    expect(mockedGetBot).toHaveBeenCalledWith("tenant-1", "bot-selected");
    expect(result.variables).toEqual({
      handed_off_to_ai: "true",
      ai_bot_id: "bot-selected",
    });
  });

  it("rejects when the selected agent has AI Assistant disabled", async () => {
    mockedIsAiAssistantEnabled.mockReturnValue(false);
    mockedGetBot.mockResolvedValueOnce(selectedBot);
    const node = {
      id: "assign-1",
      type: "assign_bot",
      position: { x: 0, y: 0 },
      data: { botId: "bot-selected" },
    } as FlowNode;

    await expect(executeAssignBotNode(node, ctx, run)).rejects.toThrow(
      "AI Assistant is not enabled for this bot"
    );
  });
});
