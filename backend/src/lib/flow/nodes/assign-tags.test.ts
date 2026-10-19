import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../tags/apply.js", () => ({
  applyTagsToContact: jest.fn(),
}));

jest.mock("../../dynamodb/lead.repository.js", () => ({
  getActiveLeadByPhone: jest.fn(),
  updateLead: jest.fn(),
}));

import { applyTagsToContact } from "../../tags/apply.js";
import {
  getActiveLeadByPhone,
  updateLead,
} from "../../dynamodb/lead.repository.js";
import { executeAssignTagsNode } from "./assign-tags.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedApply = jest.mocked(applyTagsToContact);
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
  entryNodeId: "assign-1",
  nodes: [],
  edges: [{ id: "e1", source: "assign-1", target: "end-1" }],
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
    currentNodeId: "assign-1",
    variables: {},
    stepHistory: [],
    stepCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function makeNode(data: FlowNode["data"]): FlowNode {
  return {
    id: "assign-1",
    type: "assign_tags",
    position: { x: 0, y: 0 },
    data,
  };
}

describe("executeAssignTagsNode", () => {
  beforeEach(() => {
    mockedApply.mockReset();
    mockedGetLead.mockReset();
    mockedUpdateLead.mockReset();
  });

  it("applies tags and syncs active lead", async () => {
    mockedApply.mockResolvedValue({
      phone: "573001112233",
      tenantId: "tenant-1",
      tags: ["vip", "hot"],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    } as never);
    mockedGetLead.mockResolvedValue({
      leadId: "lead-1",
      tenantId: "tenant-1",
      phone: "573001112233",
      tags: ["vip"],
      status: "new",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    } as never);
    mockedUpdateLead.mockResolvedValue(null);

    const result = await executeAssignTagsNode(
      makeNode({
        contactPhoneBinding: "{{phone}}",
        contactTags: ["vip", "hot"],
      }),
      makeCtx(),
      makeRun()
    );

    expect(mockedApply).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      phone: "573001112233",
      tagsToAdd: ["vip", "hot"],
      changedBy: "flow:assign_tags",
    });
    expect(mockedUpdateLead).toHaveBeenCalledWith("tenant-1", "lead-1", {
      tags: ["vip", "hot"],
    });
    expect(result.output).toBe("vip, hot");
    expect(result.error).toBeUndefined();
  });

  it("skips when contact is missing", async () => {
    mockedApply.mockResolvedValue(null);

    const result = await executeAssignTagsNode(
      makeNode({
        contactPhoneBinding: "{{phone}}",
        contactTags: ["vip"],
      }),
      makeCtx(),
      makeRun()
    );

    expect(result.output).toBe("skipped: contact not found");
    expect(result.error).toBe("Contact not found");
    expect(mockedUpdateLead).not.toHaveBeenCalled();
  });

  it("skips when no tags configured", async () => {
    const result = await executeAssignTagsNode(
      makeNode({ contactPhoneBinding: "{{phone}}", contactTags: [] }),
      makeCtx(),
      makeRun()
    );

    expect(result.output).toBe("skipped: missing tags");
    expect(mockedApply).not.toHaveBeenCalled();
  });
});
