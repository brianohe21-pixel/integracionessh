import type { FlowDefinition } from "../../types/index.js";

export function sanitizeFlowEdges(flow: FlowDefinition): FlowDefinition {
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  const edges = flow.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  if (edges.length === flow.edges.length) return flow;
  return { ...flow, edges };
}

export function getNextNodeId(
  flow: FlowDefinition,
  currentNodeId: string,
  sourceHandle?: string
): string | null {
  const edge = flow.edges.find(
    (e) =>
      e.source === currentNodeId &&
      (sourceHandle === undefined || e.sourceHandle === sourceHandle || !e.sourceHandle)
  );
  return edge?.target ?? null;
}

export function getOutgoingEdges(flow: FlowDefinition, nodeId: string) {
  return flow.edges.filter((e) => e.source === nodeId);
}
