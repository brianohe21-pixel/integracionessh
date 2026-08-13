import { validateFlowDefinition } from "./validate.js";
import type { FlowDefinition } from "../../types/index.js";

function baseFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    flowId: "flow-1",
    tenantId: "tenant-1",
    botId: "bot-1",
    name: "Test",
    enabled: true,
    version: 1,
    entryNodeId: "trigger-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { triggerType: "web_form_submitted" },
      },
      {
        id: "save-1",
        type: "save_contact",
        position: { x: 0, y: 100 },
        data: { contactPhoneBinding: "{{form.phone}}" },
      },
      { id: "end-1", type: "end", position: { x: 0, y: 200 }, data: {} },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "save-1" },
      { id: "e2", source: "save-1", target: "end-1" },
    ],
    ...overrides,
  };
}

describe("validateFlowDefinition", () => {
  it("accepts a valid form flow", () => {
    expect(validateFlowDefinition(baseFlow())).toEqual([]);
  });

  it("requires phone binding for save_contact", () => {
    const issues = validateFlowDefinition(
      baseFlow({
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { triggerType: "web_form_submitted" },
          },
          { id: "save-1", type: "save_contact", position: { x: 0, y: 100 }, data: {} },
          { id: "end-1", type: "end", position: { x: 0, y: 200 }, data: {} },
        ],
      })
    );
    expect(issues.some((issue) => issue.code === "missing_binding")).toBe(true);
  });

  it("rejects conversation-only nodes in form flows", () => {
    const issues = validateFlowDefinition(
      baseFlow({
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { triggerType: "web_form_submitted" },
          },
          { id: "buttons-1", type: "buttons", position: { x: 0, y: 100 }, data: {} },
          { id: "end-1", type: "end", position: { x: 0, y: 200 }, data: {} },
        ],
        edges: [
          { id: "e1", source: "trigger-1", target: "buttons-1" },
          { id: "e2", source: "buttons-1", target: "end-1" },
        ],
      })
    );
    expect(issues.some((issue) => issue.code === "unsupported_node")).toBe(true);
  });

  it("requires voice tool names for voice http nodes", () => {
    const issues = validateFlowDefinition(
      baseFlow({
        flowKind: "voice_ai",
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { triggerType: "voice_call", flowVariables: {} },
          },
          {
            id: "http-1",
            type: "http_request",
            position: { x: 0, y: 100 },
            data: { httpUrl: "https://example.com" },
          },
          { id: "end-1", type: "end", position: { x: 0, y: 200 }, data: {} },
        ],
        edges: [
          { id: "e1", source: "trigger-1", target: "http-1" },
          { id: "e2", source: "http-1", target: "end-1" },
        ],
      })
    );
    expect(issues.some((issue) => issue.code === "missing_voice_tool_name")).toBe(true);
  });
});
