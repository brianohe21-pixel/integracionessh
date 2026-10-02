jest.mock("../../opportunities/form-opportunity.js", () => ({
  createOpportunityFromFormData: jest.fn(),
}));

import { executeCreateOpportunityNode } from "./create-opportunity.js";
import { createOpportunityFromFormData } from "../../opportunities/form-opportunity.js";
import type { FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedCreateOpportunity = jest.mocked(createOpportunityFromFormData);

const flow: FlowDefinition = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  name: "Test",
  enabled: true,
  version: 1,
  entryNodeId: "opp-1",
  nodes: [
    {
      id: "opp-1",
      type: "create_opportunity",
      position: { x: 0, y: 0 },
      data: {
        opportunityTitleBinding: "Nuevo contacto",
        opportunityPhoneBinding: "{{contact_phone}}",
      },
    },
    {
      id: "end-1",
      type: "end",
      position: { x: 0, y: 100 },
      data: {},
    },
  ],
  edges: [{ id: "e1", source: "opp-1", target: "end-1" }],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const node = flow.nodes[0] as FlowNode;

const run: FlowRun = {
  runId: "run-1",
  flowId: flow.flowId,
  tenantId: "tenant-1",
  status: "active",
  currentNodeId: "opp-1",
  variables: {},
  stepHistory: [],
  stepCount: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("executeCreateOpportunityNode phone binding", () => {
  beforeEach(() => {
    mockedCreateOpportunity.mockReset();
  });

  it("creates an opportunity when only a BSUID identity is available", async () => {
    mockedCreateOpportunity.mockResolvedValue({
      opportunityId: "opp-bsuid",
      tenantId: "tenant-1",
      pipelineId: "pipe-1",
      stageId: "stage-1",
      title: "Nuevo contacto",
      currency: "USD",
      stage: "new",
      tags: [],
      phone: "CO.1776217717045877",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      stageEnteredAt: "2026-10-01T00:00:00.000Z",
      lastActivityAt: "2026-10-01T00:00:00.000Z",
    });

    const ctx: FlowExecutionContext = {
      mode: "conversation",
      tenantId: "tenant-1",
      flow,
      environment: "test",
      customerPhone: "CO.1776217717045877",
      conversation: {
        conversationId: "conv-1",
        tenantId: "tenant-1",
        botId: "bot-1",
        channel: "whatsapp",
        participantId: "CO.1776217717045877",
        phoneNumber: "CO.1776217717045877",
        whatsappUserId: "CO.1776217717045877",
        status: "active",
        messageCount: 1,
        lastMessageAt: "2026-10-01T00:00:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    };

    const result = await executeCreateOpportunityNode(node, ctx, run);

    expect(mockedCreateOpportunity).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "CO.1776217717045877",
        title: "Nuevo contacto",
      })
    );
    expect(result.error).toBeUndefined();
    expect(result.output).toBe("opp-bsuid");
    expect(result.variables).toEqual({
      opportunity_id: "opp-bsuid",
      opportunity_title: "Nuevo contacto",
      contact_phone: "CO.1776217717045877",
    });
    expect(result.nextNodeId).toBe("end-1");
  });

  it("skips the node when no phone or BSUID is available", async () => {
    const ctx: FlowExecutionContext = {
      mode: "conversation",
      tenantId: "tenant-1",
      flow,
      environment: "test",
      conversation: {
        conversationId: "conv-1",
        tenantId: "tenant-1",
        botId: "bot-1",
        channel: "whatsapp",
        participantId: "web-anon",
        phoneNumber: "",
        status: "active",
        messageCount: 1,
        lastMessageAt: "2026-10-01T00:00:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    };

    const result = await executeCreateOpportunityNode(node, ctx, run);

    expect(mockedCreateOpportunity).not.toHaveBeenCalled();
    expect(result.error).toBe("Valid phone binding is required");
    expect(result.output).toBe("skipped: missing phone");
    expect(result.nextNodeId).toBe("end-1");
    expect(result.halt).toBe(false);
  });
});
