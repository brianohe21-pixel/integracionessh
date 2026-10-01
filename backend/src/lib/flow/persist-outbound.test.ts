import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../dynamodb/conversation.repository.js", () => ({
  addMessage: jest.fn(),
}));

import { addMessage } from "../dynamodb/conversation.repository.js";
import { persistFlowOutboundMessage } from "./persist-outbound.js";
import type { Bot, Conversation, FlowDefinition } from "../../types/index.js";
import type { FlowExecutionContext } from "./types.js";

const mockedAddMessage = jest.mocked(addMessage);

const flow: FlowDefinition = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Test",
  enabled: true,
  version: 1,
  nodes: [],
  edges: [],
  entryNodeId: "trigger-1",
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Bot,
    conversation: {
      conversationId: "conv-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      channel: "whatsapp",
      participantId: "573001234567",
      phoneNumber: "573001234567",
      status: "active",
      messageCount: 1,
      lastMessageAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    } as Conversation,
    flow,
    channel: "whatsapp",
    environment: "dev",
    ...overrides,
  };
}

describe("persistFlowOutboundMessage", () => {
  beforeEach(() => {
    mockedAddMessage.mockReset();
    mockedAddMessage.mockResolvedValue(undefined);
  });

  it("persists WhatsApp outbound messages in the conversation", async () => {
    await persistFlowOutboundMessage({
      ctx: buildContext(),
      content: "Hola desde el flujo",
      externalMessageId: "wamid.abc",
    });

    expect(mockedAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "wamid.abc",
        conversationId: "conv-1",
        tenantId: "tenant-1",
        role: "assistant",
        content: "Hola desde el flujo",
        channel: "whatsapp",
        externalMessageId: "wamid.abc",
        whatsappMessageId: "wamid.abc",
      }),
      "bot-1"
    );
  });

  it("skips channels whose adapter already persists on send", async () => {
    await persistFlowOutboundMessage({
      ctx: buildContext({
        channel: "webchat",
        conversation: {
          conversationId: "conv-1",
          tenantId: "tenant-1",
          botId: "bot-1",
          channel: "webchat",
          participantId: "session-1",
          phoneNumber: "session-1",
          status: "active",
          messageCount: 1,
          lastMessageAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        } as Conversation,
      }),
      content: "Hola webchat",
      externalMessageId: "wc-1",
    });

    expect(mockedAddMessage).not.toHaveBeenCalled();
  });

  it("does nothing without conversation context", async () => {
    const ctx = buildContext();
    delete ctx.conversation;

    await persistFlowOutboundMessage({
      ctx,
      content: "Sin conversacion",
    });

    expect(mockedAddMessage).not.toHaveBeenCalled();
  });
});
