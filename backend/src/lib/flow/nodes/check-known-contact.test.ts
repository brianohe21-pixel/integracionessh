import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../contacts/is-known-contact.js", () => ({
  resolveIsKnownContact: jest.fn(),
}));

import { resolveIsKnownContact } from "../../contacts/is-known-contact.js";
import { executeCheckKnownContactNode } from "./check-known-contact.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedResolve = jest.mocked(resolveIsKnownContact);

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
  entryNodeId: "check-1",
  nodes: [],
  edges: [
    { id: "e-true", source: "check-1", target: "handoff-1", sourceHandle: "true" },
    { id: "e-false", source: "check-1", target: "ai-1", sourceHandle: "false" },
  ],
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
    currentNodeId: "check-1",
    variables: {},
    stepHistory: [],
    stepCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

const node: FlowNode = {
  id: "check-1",
  type: "check_known_contact",
  position: { x: 0, y: 0 },
  data: {},
};

describe("executeCheckKnownContactNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("branches to true when the contact is known", async () => {
    mockedResolve.mockResolvedValueOnce({ isKnown: true, phone: "573001112233" });

    const result = await executeCheckKnownContactNode(node, makeCtx(), makeRun());

    expect(result).toMatchObject({
      nextNodeId: "handoff-1",
      output: "true",
      variables: {
        is_known_contact: "true",
        contact_phone: "573001112233",
        phone: "573001112233",
      },
    });
  });

  it("branches to false when the contact is new", async () => {
    mockedResolve.mockResolvedValueOnce({ isKnown: false, phone: "573001112233" });

    const result = await executeCheckKnownContactNode(node, makeCtx(), makeRun());

    expect(result).toMatchObject({
      nextNodeId: "ai-1",
      output: "false",
      variables: {
        is_known_contact: "false",
        contact_phone: "573001112233",
        phone: "573001112233",
      },
    });
  });
});
