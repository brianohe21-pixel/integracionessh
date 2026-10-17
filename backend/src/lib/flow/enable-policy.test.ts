import { getEnableBotAssignmentError } from "./enable-policy.js";
import type { FlowDefinition, FlowNode } from "../../types/index.js";

function baseFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    flowId: "flow-1",
    tenantId: "tenant-1",
    name: "Test",
    enabled: false,
    version: 1,
    nodes: [],
    edges: [],
    entryNodeId: "trigger-1",
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const messagingNodes: FlowNode[] = [
  { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { triggerType: "any_message" } },
];

const webhookDraftNodes: FlowNode[] = [
  { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { triggerType: "web_form_submitted" } },
  { id: "webhook-1", type: "webhook", position: { x: 0, y: 80 }, data: { label: "Receive JSON" } },
  { id: "end-1", type: "end", position: { x: 0, y: 160 }, data: {} },
];

describe("getEnableBotAssignmentError", () => {
  it("requires a bot for messaging flows without agent assignment", () => {
    const flow = baseFlow({
      nodes: messagingNodes,
      draftNodes: messagingNodes,
    });
    expect(getEnableBotAssignmentError(flow)).toBe(
      "Assign the flow to an agent before enabling it"
    );
  });

  it("allows enabling webhook flows from draft even when published graph is messaging-only", () => {
    const flow = baseFlow({
      nodes: messagingNodes,
      draftNodes: webhookDraftNodes,
      draftEdges: [],
    });
    expect(getEnableBotAssignmentError(flow)).toBeNull();
  });
});
