import { findTriggerFlow } from "./match-trigger.js";
import type {
  Conversation,
  FlowDefinition,
  FlowNode,
  InboundNormalized,
} from "../../types/index.js";

function node(
  type: FlowNode["type"],
  data: FlowNode["data"] = {},
  id = `${type}-1`
): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function flow(id: string, nodes: FlowNode[], enabled = true): FlowDefinition {
  return {
    flowId: id,
    tenantId: "tenant-1",
    name: id,
    enabled,
    version: 1,
    nodes,
    edges: [],
    entryNodeId: nodes[0]?.id ?? "entry",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: "conv-1",
    tenantId: "tenant-1",
    botId: "bot-1",
    channel: "whatsapp",
    participantId: "573001112233",
    phoneNumber: "573001112233",
    status: "active",
    messageCount: 1,
    lastMessageAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Conversation;
}

const inbound: InboundNormalized = {
  text: "hola",
  messageType: "text",
};

describe("findTriggerFlow WhatsApp number filter", () => {
  it("matches when all numbers are allowed", () => {
    const flows = [
      flow("f1", [
        node("message_received_trigger", {
          triggerType: "any_message",
          channel: "whatsapp",
          botId: "bot-1",
        }),
      ]),
    ];
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-a" }),
        false
      )?.flowId
    ).toBe("f1");
  });

  it("matches a specific configured number", () => {
    const flows = [
      flow("f1", [
        node("message_received_trigger", {
          triggerType: "any_message",
          channel: "whatsapp",
          whatsappChannelIds: ["ch-a", "ch-b"],
        }),
      ]),
    ];
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-b" }),
        false
      )?.flowId
    ).toBe("f1");
  });

  it("skips when the inbound number is not selected", () => {
    const flows = [
      flow("f1", [
        node("message_received_trigger", {
          triggerType: "any_message",
          channel: "whatsapp",
          whatsappChannelIds: ["ch-a"],
        }),
      ]),
    ];
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-other" }),
        false
      )
    ).toBeNull();
  });

  it("supports legacy whatsappChannelId", () => {
    const flows = [
      flow("f1", [
        node("message_received_trigger", {
          triggerType: "any_message",
          channel: "whatsapp",
          whatsappChannelId: "ch-legacy",
        }),
      ]),
    ];
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-legacy" }),
        false
      )?.flowId
    ).toBe("f1");
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-other" }),
        false
      )
    ).toBeNull();
  });

  it("matches first_message only for new conversations", () => {
    const flows = [
      flow("f1", [
        node("message_received_trigger", {
          triggerType: "first_message",
          channel: "whatsapp",
          whatsappChannelIds: ["ch-a"],
        }),
      ]),
    ];
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-a" }),
        true
      )?.flowId
    ).toBe("f1");
    expect(
      findTriggerFlow(
        flows,
        inbound,
        conversation({ whatsappChannelId: "ch-a" }),
        false
      )
    ).toBeNull();
  });
});
