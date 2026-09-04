import { sanitizeFlowEdges } from "./graph.js";
import type { FlowDefinition } from "../../types/index.js";

function flow(nodes: FlowDefinition["nodes"], edges: FlowDefinition["edges"]): FlowDefinition {
  return {
    flowId: "flow-1",
    tenantId: "tenant-1",
    name: "Test",
    enabled: false,
    version: 1,
    nodes,
    edges,
    entryNodeId: nodes[0]?.id ?? "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("sanitizeFlowEdges", () => {
  it("removes edges that reference deleted nodes", () => {
    const nodes = [
      { id: "a", type: "trigger" as const, position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "end" as const, position: { x: 0, y: 100 }, data: {} },
    ];
    const edges = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "missing" },
      { id: "e3", source: "missing", target: "b" },
    ];

    const result = sanitizeFlowEdges(flow(nodes, edges));

    expect(result.edges).toEqual([{ id: "e1", source: "a", target: "b" }]);
  });

  it("returns the same flow when all edges are valid", () => {
    const input = flow(
      [
        { id: "a", type: "trigger", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "message", position: { x: 0, y: 100 }, data: {} },
      ],
      [{ id: "e1", source: "a", target: "b" }]
    );

    expect(sanitizeFlowEdges(input)).toBe(input);
  });
});
