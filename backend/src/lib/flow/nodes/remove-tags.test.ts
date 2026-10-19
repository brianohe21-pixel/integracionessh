import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../tags/apply.js", () => ({
  removeTagsFromContact: jest.fn(),
}));

jest.mock("../../dynamodb/lead.repository.js", () => ({
  getActiveLeadByPhone: jest.fn(),
  updateLead: jest.fn(),
}));

import { removeTagsFromContact } from "../../tags/apply.js";
import {
  getActiveLeadByPhone,
  updateLead,
} from "../../dynamodb/lead.repository.js";
import { executeRemoveTagsNode } from "./remove-tags.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedRemove = jest.mocked(removeTagsFromContact);
const mockedGetLead = jest.mocked(getActiveLeadByPhone);
const mockedUpdateLead = jest.mocked(updateLead);

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
  entryNodeId: "remove-1",
  nodes: [],
  edges: [{ id: "e1", source: "remove-1", target: "end-1" }],
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
    currentNodeId: "remove-1",
    variables: {},
    stepHistory: [],
    stepCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function makeNode(data: FlowNode["data"]): FlowNode {
  return {
    id: "remove-1",
    type: "remove_tags",
    position: { x: 0, y: 0 },
    data,
  };
}

describe("executeRemoveTagsNode", () => {
  beforeEach(() => {
    mockedRemove.mockReset();
    mockedGetLead.mockReset();
    mockedUpdateLead.mockReset();
  });

  it("removes tags from contact and active lead", async () => {
    mockedRemove.mockResolvedValue({
      phone: "573001112233",
      tenantId: "tenant-1",
      tags: ["vip"],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    } as never);
    mockedGetLead.mockResolvedValue({
      leadId: "lead-1",
      tenantId: "tenant-1",
      phone: "573001112233",
      tags: ["vip", "hot"],
      status: "new",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    } as never);
    mockedUpdateLead.mockResolvedValue(null);

    const result = await executeRemoveTagsNode(
      makeNode({
        contactPhoneBinding: "{{phone}}",
        contactTags: ["hot"],
      }),
      makeCtx(),
      makeRun()
    );

    expect(mockedRemove).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      phone: "573001112233",
      tagsToRemove: ["hot"],
    });
    expect(mockedUpdateLead).toHaveBeenCalledWith("tenant-1", "lead-1", {
      tags: ["vip"],
    });
    expect(result.output).toBe("hot");
  });

  it("skips when contact is missing", async () => {
    mockedRemove.mockResolvedValue(null);

    const result = await executeRemoveTagsNode(
      makeNode({
        contactPhoneBinding: "{{phone}}",
        contactTags: ["hot"],
      }),
      makeCtx(),
      makeRun()
    );

    expect(result.output).toBe("skipped: contact not found");
    expect(mockedUpdateLead).not.toHaveBeenCalled();
  });
});
